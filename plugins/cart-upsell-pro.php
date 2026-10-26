<?php
/**
 * Plugin Name: Cart Upsell Pro
 * Description: Slimme cart upsell + ordering flow met IP-sticky load balancing, custom checkout opties, volledige multilingual handover en directe order-completion na betaling.
 * Version: 3.7.0
 * Author: Plugin Author
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) exit;
require_once __DIR__ . '/cup-order-preview.php';

/* =====================================================================
 * Constants
 * ===================================================================== */
define( 'CUP_PLUGIN_FILE',  __FILE__ );
define( 'CUP_TABLE',        'cup_sessions' );
define( 'CUP_ROUTES_TABLE', 'cup_ip_routes' );
define( 'CUP_TOKEN_TTL',    30 * MINUTE_IN_SECONDS ); // 30 min
define( 'CUP_GATEWAY_ID',   'cart_upsell_pro' );
define( 'CUP_REDIRECT_RECOVERY_TTL', 2 * MINUTE_IN_SECONDS );

require_once __DIR__ . '/cup-direct-checkout.php';
require_once __DIR__ . '/cup-short-handover.php';

/* =====================================================================
 * Activation: create sessions + ip_routes tables
 * ===================================================================== */
register_activation_hook( __FILE__, 'cup_install' );
function cup_install() {
    global $wpdb;
    $charset = $wpdb->get_charset_collate();

    $table = $wpdb->prefix . CUP_TABLE;
    $sql_sessions = "CREATE TABLE $table (
        id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        token_hash CHAR(64) NOT NULL,
        order_id BIGINT(20) UNSIGNED NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'created',
        amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
        payload_json LONGTEXT NULL,
        ip_address VARCHAR(64) NULL,
        user_agent VARCHAR(255) NULL,
        site_index SMALLINT NOT NULL DEFAULT 0,
        site_url VARCHAR(255) NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NULL,
        expires_at DATETIME NOT NULL,
        confirmed_at DATETIME NULL,
        PRIMARY KEY (id),
        UNIQUE KEY token_hash (token_hash),
        KEY order_id (order_id),
        KEY status (status)
    ) $charset;";

    $rtable = $wpdb->prefix . CUP_ROUTES_TABLE;
    $sql_routes = "CREATE TABLE $rtable (
        id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        ip_hash CHAR(64) NOT NULL,
        site_index SMALLINT NOT NULL,
        assignments INT(11) NOT NULL DEFAULT 1,
        first_seen DATETIME NOT NULL,
        last_seen DATETIME NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY ip_hash (ip_hash),
        KEY site_index (site_index),
        KEY last_seen (last_seen)
    ) $charset;";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta( $sql_sessions );
    dbDelta( $sql_routes );
}

/* =====================================================================
 * Cryptography helpers
 * AES-256-GCM with separate keys for encryption vs HMAC.
 * Keys derived from a single user-supplied master "secret_key".
 * ===================================================================== */
function cup_derive_keys() {
    $opts   = get_option( 'cup_settings', [] );
    $master = (string) ( $opts['secret_key'] ?? '' );
    if ( $master === '' ) return [ '', '' ];
    $enc    = hash_hkdf( 'sha256', $master, 32, 'agv2-enc' );
    $mac    = hash_hkdf( 'sha256', $master, 32, 'agv2-mac' );
    return [ $enc, $mac ];
}

function cup_b64url_encode( string $bin ): string {
    return rtrim( strtr( base64_encode( $bin ), '+/', '-_' ), '=' );
}
function cup_b64url_decode( string $s ): string {
    $s = strtr( $s, '-_', '+/' );
    $p = strlen( $s ) % 4;
    if ( $p ) $s .= str_repeat( '=', 4 - $p );
    $r = base64_decode( $s, true );
    return is_string( $r ) ? $r : '';
}

/**
 * Encrypt a payload array into an opaque URL-safe token.
 * Format: v2.<b64url(iv)>.<b64url(ct||tag)>
 */
function cup_encrypt_token( array $payload ): string {
    [ $enc_key, $mac_key ] = cup_derive_keys();
    if ( $enc_key === '' ) return '';
    if ( ! function_exists( 'openssl_encrypt' ) ) return '';

    $json = wp_json_encode( $payload );
    if ( ! is_string( $json ) ) return '';

    $iv  = random_bytes( 12 );
    $tag = '';
    $ct  = openssl_encrypt( $json, 'aes-256-gcm', $enc_key, OPENSSL_RAW_DATA, $iv, $tag );
    if ( $ct === false ) return '';

    // bind ciphertext to MAC key for extra defense-in-depth: prepend HMAC(iv||ct||tag)
    $mac = hash_hmac( 'sha256', $iv . $ct . $tag, $mac_key, true );
    $blob = $iv . $tag . $ct . $mac;
    return 'v2.' . cup_b64url_encode( $blob );
}

/* =====================================================================
 * Audit helpers
 * ===================================================================== */
function cup_session_insert( string $token, int $order_id, float $amount, string $currency, array $payload, int $site_index = 0, string $site_url = '' ) {
    global $wpdb;
    $table = $wpdb->prefix . CUP_TABLE;
    $hash  = hash( 'sha256', $token );
    $now   = current_time( 'mysql' );
    $exp   = gmdate( 'Y-m-d H:i:s', time() + CUP_TOKEN_TTL );
    return $wpdb->insert( $table, [
        'token_hash'   => $hash,
        'order_id'     => $order_id,
        'status'       => 'created',
        'amount'       => $amount,
        'currency'     => $currency,
        'payload_json' => wp_json_encode( $payload ),
        'ip_address'   => cup_client_ip(),
        'user_agent'   => isset( $_SERVER['HTTP_USER_AGENT'] ) ? substr( (string) $_SERVER['HTTP_USER_AGENT'], 0, 255 ) : '',
        'site_index'   => $site_index,
        'site_url'     => $site_url,
        'created_at'   => $now,
        'updated_at'   => $now,
        'expires_at'   => $exp,
    ], [ '%s','%d','%s','%f','%s','%s','%s','%s','%d','%s','%s','%s','%s' ] );
}

function cup_session_update_status( string $token, string $status ) {
    global $wpdb;
    $table = $wpdb->prefix . CUP_TABLE;
    $hash  = hash( 'sha256', $token );
    $now   = current_time( 'mysql' );
    $data  = [ 'status' => $status, 'updated_at' => $now ];
    $fmt   = [ '%s', '%s' ];
    if ( $status === 'paid' ) {
        $data['confirmed_at'] = $now;
        $fmt[] = '%s';
    }
    return (bool) $wpdb->update( $table, $data, [ 'token_hash' => $hash ], $fmt, [ '%s' ] );
}

function cup_session_get_by_token_hash( string $token_hash ) {
    global $wpdb;
    $table = $wpdb->prefix . CUP_TABLE;
    return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE token_hash=%s LIMIT 1", $token_hash ) );
}

function cup_client_ip(): string {
    $candidates = [];

    if ( ! empty( $_SERVER['HTTP_CF_CONNECTING_IP'] ) ) {
        $candidates[] = (string) $_SERVER['HTTP_CF_CONNECTING_IP'];
    }
    if ( ! empty( $_SERVER['HTTP_X_FORWARDED_FOR'] ) ) {
        $candidates = array_merge( $candidates, explode( ',', (string) $_SERVER['HTTP_X_FORWARDED_FOR'] ) );
    }
    if ( ! empty( $_SERVER['HTTP_X_REAL_IP'] ) ) {
        $candidates[] = (string) $_SERVER['HTTP_X_REAL_IP'];
    }
    $candidates[] = (string) ( $_SERVER['REMOTE_ADDR'] ?? '' );

    foreach ( $candidates as $candidate ) {
        $candidate = trim( $candidate );
        if ( filter_var( $candidate, FILTER_VALIDATE_IP ) ) return $candidate;
    }
    return '';
}

/* =====================================================================
 * Site B routing — single or rotating with IP-sticky assignment.
 * Returns: [ 'url' => '...', 'index' => 0 ]  OR  WP_Error
 * ===================================================================== */
function cup_get_rotating_urls( array $opts ): array {
    $raw   = (string) ( $opts['rotating_urls'] ?? '' );
    $lines = preg_split( '/\r?\n/', $raw );
    $out   = [];
    foreach ( $lines as $ln ) {
        $ln = preg_replace( '#/+$#', '', trim( $ln ) );
        if ( $ln !== '' && preg_match( '#^https?://[^\s/]+(/.*)?$#i', $ln ) ) {
            $out[] = $ln;
        }
    }
    return array_values( array_unique( $out ) );
}

function cup_pick_site_b( array $opts ) {
    $mode = (string) ( $opts['mode'] ?? 'single' );

    if ( $mode !== 'rotating' ) {
        $base = isset( $opts['bridge_url'] ) ? rtrim( trim( (string) $opts['bridge_url'] ), '/' ) : '';
        if ( $base === '' ) return new WP_Error( 'no_url', 'Geen Site B URL geconfigureerd.' );
        return [ 'url' => $base, 'index' => 0 ];
    }

    $urls = cup_get_rotating_urls( $opts );
    if ( empty( $urls ) ) return new WP_Error( 'no_urls', 'Roterende modus is geselecteerd maar er staan geen geldige URLs in het veld.' );

    $sticky_days = max( 1, (int) ( $opts['sticky_days'] ?? 30 ) );

    $ip = cup_client_ip();
    if ( $ip === '' ) {
        // Geen IP bekend → kies eenvoudig de eerste (deterministisch genoeg).
        return [ 'url' => $urls[0], 'index' => 0 ];
    }
    /*
     * Bind a sticky assignment to this exact ordered URL list. Older versions
     * stored only a numeric index, so changing [A,B,C] to [B,C] could silently
     * turn an old B assignment into C. A list-scoped hash makes every changed
     * rotation list start with fresh, fair assignments without deleting history.
     */
    $route_list_hash = hash( 'sha256', implode( "\n", $urls ) );
    $ip_hash         = hash( 'sha256', $ip . '|' . $route_list_hash );

    global $wpdb;
    $table = $wpdb->prefix . CUP_ROUTES_TABLE;

    // Lookup existing sticky assignment within window.
    $row = $wpdb->get_row( $wpdb->prepare(
        "SELECT * FROM $table WHERE ip_hash=%s LIMIT 1", $ip_hash
    ) );

    $now      = current_time( 'mysql' );
    $cutoff   = gmdate( 'Y-m-d H:i:s', time() - ( $sticky_days * DAY_IN_SECONDS ) );

    if ( $row && $row->last_seen >= $cutoff && isset( $urls[ (int) $row->site_index ] ) ) {
        $wpdb->update( $table, [
            'last_seen'   => $now,
            'assignments' => (int) $row->assignments + 1,
        ], [ 'ip_hash' => $ip_hash ], [ '%s', '%d' ], [ '%s' ] );
        return [ 'url' => $urls[ (int) $row->site_index ], 'index' => (int) $row->site_index ];
    }

    // No sticky match → round-robin pick.
    $idx = cup_round_robin_index( count( $urls ) );

    if ( $row ) {
        $wpdb->update( $table, [
            'site_index'  => $idx,
            'last_seen'   => $now,
            'assignments' => (int) $row->assignments + 1,
        ], [ 'ip_hash' => $ip_hash ], [ '%d', '%s', '%d' ], [ '%s' ] );
    } else {
        $wpdb->insert( $table, [
            'ip_hash'     => $ip_hash,
            'site_index'  => $idx,
            'assignments' => 1,
            'first_seen'  => $now,
            'last_seen'   => $now,
        ], [ '%s', '%d', '%d', '%s', '%s' ] );
    }

    return [ 'url' => $urls[ $idx ], 'index' => $idx ];
}

/**
 * Pick the next index in round-robin fashion. State stored in an option.
 */
function cup_round_robin_index( int $count ): int {
    if ( $count <= 1 ) return 0;

    /*
     * Atomic sequence: simultaneous checkouts must not all read the same option
     * value before one of them writes it back. LAST_INSERT_ID is connection-local,
     * while the UPDATE itself is serialized by MySQL.
     */
    global $wpdb;
    $option_name = 'cup_rr_sequence';
    add_option( $option_name, '0', '', false );

    $updated = $wpdb->query( $wpdb->prepare(
        "UPDATE {$wpdb->options}
         SET option_value = LAST_INSERT_ID(CAST(option_value AS UNSIGNED) + 1)
         WHERE option_name = %s",
        $option_name
    ) );

    if ( $updated ) {
        $sequence = (int) $wpdb->get_var( 'SELECT LAST_INSERT_ID()' );
        wp_cache_delete( $option_name, 'options' );
        return max( 0, ( $sequence - 1 ) % $count );
    }

    // Conservative fallback if the atomic update is unavailable.
    $last = (int) get_option( 'cup_rr_last_index', -1 );
    $next = ( $last + 1 ) % $count;
    update_option( 'cup_rr_last_index', $next, false );
    return $next;
}

/**
 * Confirm that a recovery redirect still points at the Site B base that
 * generated it. The URL itself is kept server-side in the Woo session.
 */
function cup_redirect_matches_site( string $url, string $site_base ): bool {
    $target = wp_parse_url( $url );
    $base   = wp_parse_url( $site_base );
    if ( ! is_array( $target ) || ! is_array( $base ) ) return false;
    if ( strtolower( (string) ( $target['scheme'] ?? '' ) ) !== 'https' ) return false;
    if ( strtolower( (string) ( $base['scheme'] ?? '' ) ) !== 'https' ) return false;
    if ( strtolower( (string) ( $target['host'] ?? '' ) ) !== strtolower( (string) ( $base['host'] ?? '' ) ) ) return false;
    if ( (int) ( $target['port'] ?? 443 ) !== (int) ( $base['port'] ?? 443 ) ) return false;
    if ( isset( $target['user'] ) || isset( $target['pass'] ) ) return false;

    $base_path   = '/' . trim( (string) ( $base['path'] ?? '' ), '/' );
    $target_path = '/' . trim( (string) ( $target['path'] ?? '' ), '/' );
    if ( $base_path !== '/' && $target_path !== $base_path && strpos( $target_path, $base_path . '/' ) !== 0 ) return false;
    return true;
}

/**
 * Recover a redirect that was created successfully, but whose checkout AJAX
 * response was rejected or swallowed by a theme/browser layer.
 */
add_action( 'wc_ajax_cup_recover_redirect', 'cup_ajax_recover_redirect' );
function cup_ajax_recover_redirect() {
    nocache_headers();
    if ( ! function_exists( 'WC' ) || ! WC()->session ) {
        if ( function_exists( 'wc_get_logger' ) ) wc_get_logger()->warning( 'Checkout-herstel zonder WooCommerce-sessie.', [ 'source' => 'cart-upsell-pro' ] );
        wp_send_json_error( [ 'message' => 'no_session' ], 404 );
    }

    $pending = WC()->session->get( 'cup_pending_redirect' );
    if ( ! is_array( $pending ) ) {
        if ( function_exists( 'wc_get_logger' ) ) wc_get_logger()->info( 'Checkout-herstel aangeroepen, maar er stond geen betaallink in de sessie.', [ 'source' => 'cart-upsell-pro' ] );
        wp_send_json_error( [ 'message' => 'none' ], 404 );
    }

    $created   = (int) ( $pending['created'] ?? 0 );
    $order_id  = (int) ( $pending['order_id'] ?? 0 );
    $url       = (string) ( $pending['url'] ?? '' );
    $site_base = (string) ( $pending['site_base'] ?? '' );
    $order     = $order_id > 0 ? wc_get_order( $order_id ) : false;

    if ( $created < time() - CUP_REDIRECT_RECOVERY_TTL || ! $order ||
        $order->get_payment_method() !== CUP_GATEWAY_ID ||
        ! cup_redirect_matches_site( $url, $site_base ) ) {
        if ( function_exists( 'wc_get_logger' ) ) {
            wc_get_logger()->warning( 'Checkout-herstel afgewezen.', [
                'source' => 'cart-upsell-pro',
                'order_id' => $order_id,
                'age' => $created > 0 ? time() - $created : null,
                'has_order' => (bool) $order,
                'payment_method' => $order ? $order->get_payment_method() : '',
                'destination_valid' => cup_redirect_matches_site( $url, $site_base ),
            ] );
        }
        WC()->session->__unset( 'cup_pending_redirect' );
        WC()->session->save_data();
        wp_send_json_error( [ 'message' => 'expired' ], 410 );
    }

    if ( function_exists( 'wc_get_logger' ) ) {
        wc_get_logger()->info( 'Checkout-doorsturing hersteld.', [
            'source' => 'cart-upsell-pro', 'order_id' => $order_id,
        ] );
    }
    wp_send_json_success( [ 'redirect' => esc_url_raw( $url ) ] );
}

/**
 * Invisible same-origin transition accepted by two-step checkout themes.
 * The final Site B URL was already built and allowlisted server-side.
 */
add_action( 'template_redirect', 'cup_forward_pending_redirect', 0 );
function cup_forward_pending_redirect() {
    if ( empty( $_GET['cup_forward'] ) || ! function_exists( 'WC' ) || ! WC()->session ) return;

    $key     = sanitize_text_field( wp_unslash( (string) $_GET['cup_forward'] ) );
    $pending = WC()->session->get( 'cup_pending_redirect' );
    $valid   = is_array( $pending ) && ! empty( $pending['forward_hash'] ) &&
        hash_equals( (string) $pending['forward_hash'], hash( 'sha256', $key ) );
    $created   = $valid ? (int) ( $pending['created'] ?? 0 ) : 0;
    $order_id  = $valid ? (int) ( $pending['order_id'] ?? 0 ) : 0;
    $url       = $valid ? (string) ( $pending['url'] ?? '' ) : '';
    $site_base = $valid ? (string) ( $pending['site_base'] ?? '' ) : '';
    $order     = $order_id > 0 ? wc_get_order( $order_id ) : false;
    $valid     = $valid && $created >= time() - CUP_REDIRECT_RECOVERY_TTL && $order &&
        $order->get_payment_method() === CUP_GATEWAY_ID &&
        cup_redirect_matches_site( $url, $site_base ) && esc_url_raw( $url ) !== '';

    if ( ! $valid ) {
        WC()->session->__unset( 'cup_pending_redirect' );
        WC()->session->save_data();
        wp_safe_redirect( remove_query_arg( 'cup_forward', wc_get_checkout_url() ) );
        exit;
    }

    nocache_headers();
    header( 'Referrer-Policy: no-referrer' );
    WC()->session->__unset( 'cup_pending_redirect' );
    WC()->session->save_data();
    wp_redirect( esc_url_raw( $url ), 302, 'Cart Upsell Pro' );
    exit;
}

/* =====================================================================
 * Gateway class
 * ===================================================================== */
add_action( 'plugins_loaded', function () {
    if ( ! class_exists( 'WC_Payment_Gateway' ) ) return;
    if ( class_exists( 'WC_Gateway_Cart_Upsell_Pro' ) ) return;

    class WC_Gateway_Cart_Upsell_Pro extends WC_Payment_Gateway {
        public function __construct() {
            $this->id                 = CUP_GATEWAY_ID;
            $this->method_title       = 'Cart Upsell Pro';
            $this->method_description = 'Stuurt klant via versleutelde token naar Site B. Geen iFrame. Geen data in URL.';
            $this->has_fields         = false;
            $this->supports           = [ 'products' ];

            $this->init_form_fields();
            $this->init_settings();

            $this->title       = $this->get_option( 'title', 'Online Betaling' );
            $this->description = $this->get_option( 'description', '' );

            add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, [ $this, 'process_admin_options' ] );
            add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_scripts' ] );
        }

        public function init_form_fields() {
            $this->form_fields = [
                'enabled'      => [ 'title' => 'Activeren', 'type' => 'checkbox', 'label' => 'Activeer Cart Upsell Pro', 'default' => 'yes' ],
                'title'        => [ 'title' => 'Titel', 'type' => 'text', 'default' => 'Online Betaling' ],
                'description'  => [ 'title' => 'Beschrijving', 'type' => 'textarea', 'default' => 'Veilig afrekenen via onze betaalpartner.' ],
                'send_order_preview' => [ 'title' => 'Besteloverzicht op Site B', 'type' => 'checkbox', 'label' => 'Stuur productfoto’s, titels, aantallen, varianten en prijzen mee', 'default' => 'no', 'description' => 'Alleen voor weergave op de betaalpagina van Site B. Foto’s worden vanaf Site A geladen. Er worden geen producten of media op Site B aangemaakt. Geldt voor nieuwe overdrachten; vereist Site B 3.8.4 of hoger.' ],
                'skip_checkout' => [
                    'title'       => 'Checkout overslaan',
                    'type'        => 'checkbox',
                    'label'       => 'Stuur klanten vanuit de winkelwagen direct naar Site B',
                    'default'     => 'no',
                    'description' => 'Slaat het checkoutformulier op Site A over bij het openen van een checkoutlink. Stuurt het actuele winkelwagentotaal door. Activeer op Site B Betaling met los bedrag; de betaalprovider vraagt de klantgegevens uit. Verzendkosten en belastingen zijn gebaseerd op wat al in de winkelwagen bekend is. Uitschakelen herstelt de bestaande betaalmethodeflow.',
                ],

                'mode' => [
                    'title'       => 'Modus',
                    'type'        => 'select',
                    'default'     => 'single',
                    'options'     => [
                        'single'    => 'Enkele Site B',
                        'rotating'  => 'Roterend over meerdere Site B\'s (IP-sticky)',
                    ],
                    'description' => 'Bij "Roterend" wordt het verkeer eerlijk verdeeld over de URLs hieronder; dezelfde klant (IP) komt binnen het sticky-venster altijd op dezelfde Site B.',
                ],

                'bridge_url'   => [
                    'title'       => 'Site B basis-URL (Enkel-modus)',
                    'type'        => 'text',
                    'placeholder' => 'https://site-b.example',
                    'description' => 'Alleen gebruikt in modus "Enkele Site B". Zonder trailing slash.',
                ],

                'rotating_urls' => [
                    'title'       => 'Roterende Site B URLs (één per regel)',
                    'type'        => 'textarea',
                    'description' => 'Alleen gebruikt in modus "Roterend". Eén URL per regel, zonder trailing slash. Bijv.:<br><code>https://shop1.example<br>https://shop2.example<br>https://shop3.example</code>',
                    'css'         => 'min-height:120px;font-family:monospace;',
                    'default'     => '',
                ],

                'sticky_days' => [
                    'title'       => 'Sticky-venster (dagen)',
                    'type'        => 'number',
                    'default'     => '30',
                    'description' => 'Hoeveel dagen onthoudt Site A welke Site B een klant heeft gekregen. Komt klant binnen die periode terug, dan zelfde Site B. Anders nieuwe toewijzing.',
                    'custom_attributes' => [ 'min' => '1', 'max' => '365', 'step' => '1' ],
                ],

                'handover_transport' => [
                    'title' => 'Overdracht tussen sites', 'type' => 'select', 'default' => 'legacy',
                    'options' => [ 'legacy' => 'Bestaande betaallink', 'short' => 'Korte betaallink' ],
                    'description' => 'Kies Korte betaallink nadat alle ontvangende sites Smart Image Optimizer Pro 3.8.0 hebben. Beide sites moeten HTTPS gebruiken.',
                ],
                'secret_key'   => [
                    'title'       => 'Geheime sleutel (master)',
                    'type'        => 'password',
                    'description' => 'Minstens 32 willekeurige tekens. <strong>Moet identiek zijn op Site A en op ALLE Site B\'s.</strong> Hieruit worden afzonderlijke encryptie- en HMAC-sleutels afgeleid.',
                ],
            ];
        }

        public function process_payment( $order_id ) {
            $order = wc_get_order( $order_id );
            if ( ! $order ) {
                wc_add_notice( 'Order niet gevonden.', 'error' );
                return [ 'result' => 'failure' ];
            }

            try {
                $res = cup_build_redirect( $order );
                if ( isset( $res['error'] ) ) {
                    if ( function_exists( 'wc_get_logger' ) ) {
                        wc_get_logger()->warning( (string) $res['error'], [
                            'source' => 'cart-upsell-pro', 'order_id' => $order->get_id(),
                        ] );
                    }
                    wc_add_notice( $res['error'], 'error' );
                    return [ 'result' => 'failure' ];
                }
            } catch ( Throwable $e ) {
                if ( function_exists( 'wc_get_logger' ) ) {
                    wc_get_logger()->error( $e->getMessage(), [
                        'source' => 'cart-upsell-pro',
                        'order_id' => $order->get_id(),
                        'exception' => get_class( $e ),
                    ] );
                }
                wc_add_notice( 'De beveiligde betaaloverdracht kon niet worden voorbereid. Probeer opnieuw of neem contact op met de webwinkel.', 'error' );
                return [ 'result' => 'failure' ];
            }

            // Keep a short-lived, session-bound recovery copy. Some themes can
            // discard Woo's successful AJAX response after the order is made.
            $forward_key = wp_generate_password( 40, false, false );
            $checkout_redirect = (string) $res['url'];
            if ( function_exists( 'WC' ) && WC()->session ) {
                WC()->session->set( 'cup_pending_redirect', [
                    'created'   => time(),
                    'order_id'  => (int) $order->get_id(),
                    'url'       => (string) $res['url'],
                    'site_base' => (string) $order->get_meta( '_cup_site_url' ),
                    'forward_hash' => hash( 'sha256', $forward_key ),
                ] );
                WC()->session->save_data();
                if ( function_exists( 'wc_get_logger' ) ) {
                    wc_get_logger()->info( 'Tijdelijke checkout-doorsturing in WooCommerce-sessie opgeslagen.', [
                        'source' => 'cart-upsell-pro', 'order_id' => $order->get_id(),
                    ] );
                }
                $checkout_redirect = add_query_arg( 'cup_forward', rawurlencode( $forward_key ), wc_get_checkout_url() );
            }

            // Cart NIET nu legen. Pas legen na bevestigde betaling.
            return [ 'result' => 'success', 'redirect' => $checkout_redirect ];
        }

        public function enqueue_scripts() {
            if ( ! function_exists( 'is_checkout' ) || ! is_checkout() || is_order_received_page() ) return;
            $p = plugin_dir_path( __FILE__ ) . 'cup-checkout.js';
            if ( file_exists( $p ) ) {
                wp_enqueue_script( 'cup-checkout', plugin_dir_url( __FILE__ ) . 'cup-checkout.js', [ 'jquery' ], filemtime( $p ), true );
                if ( class_exists( 'WC_AJAX' ) ) {
                    wp_localize_script( 'cup-checkout', 'cupCheckoutRecovery', [
                        'url' => WC_AJAX::get_endpoint( 'cup_recover_redirect' ),
                    ] );
                }
            }
        }

        public function admin_options() {
            echo '<h3>' . esc_html( $this->get_method_title() ) . '</h3>';
            echo '<p>' . wp_kses_post( $this->method_description ) . '</p>';
            echo '<div class="notice inline notice-info"><p><strong>Belangrijk:</strong> de geheime sleutel moet exact gelijk zijn aan die op Site B. Genereer een sterke sleutel (32+ random tekens) en bewaar 1x veilig.</p></div>';
            echo '<table class="form-table">'; $this->generate_settings_html(); echo '</table>';
        }
    }
});

add_filter( 'woocommerce_payment_gateways', function ( $g ) {
    $g[] = 'WC_Gateway_Cart_Upsell_Pro';
    return $g;
});

add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), function ( $links ) {
    $url = admin_url( 'admin.php?page=wc-settings&tab=checkout&section=' . CUP_GATEWAY_ID );
    array_unshift( $links, '<a href="' . esc_url( $url ) . '">Instellingen</a>' );
    return $links;
});

/* =====================================================================
 * Settings option name compat: WC saves to woocommerce_<id>_settings.
 * We mirror into cup_settings so our standalone helpers can read it.
 * ===================================================================== */
add_action( 'update_option_woocommerce_' . CUP_GATEWAY_ID . '_settings', function ( $old, $new ) {
    if ( is_array( $new ) ) update_option( 'cup_settings', $new, false );
}, 10, 2 );

// On load, if cup_settings empty but WC version exists, mirror once.
add_action( 'init', function () {
    $a = get_option( 'cup_settings', null );
    if ( $a === null ) {
        $b = get_option( 'woocommerce_' . CUP_GATEWAY_ID . '_settings', null );
        if ( is_array( $b ) ) update_option( 'cup_settings', $b, false );
    }
}, 1 );

/* =====================================================================
 * Build redirect to Site B with encrypted opaque token
 * ===================================================================== */
function cup_build_redirect( $order ) {
    $timing_start = microtime( true );
    register_shutdown_function( function () use ( $timing_start, $order ) { cbr_timing( 'a_build_to_response', $timing_start, (int) $order->get_id() ); } );
    $opts = get_option( 'cup_settings', [] );
    if ( empty( $opts ) ) $opts = get_option( 'woocommerce_' . CUP_GATEWAY_ID . '_settings', [] );

    $secret = isset( $opts['secret_key'] ) ? trim( (string) $opts['secret_key'] ) : '';
    if ( $secret === '' ) {
        return [ 'error' => 'Plugin is niet volledig geconfigureerd. (Geheime sleutel ontbreekt.)' ];
    }
    if ( strlen( $secret ) < 24 ) {
        return [ 'error' => 'Geheime sleutel is te kort. Gebruik 32+ tekens.' ];
    }

    $route = cup_pick_site_b( $opts );
    if ( is_wp_error( $route ) ) {
        return [ 'error' => $route->get_error_message() ];
    }
    $base        = $route['url'];
    $site_index  = (int) $route['index'];

    $payload = [
        'v'           => 2,
        'order_id'    => (int) $order->get_id(),
        'order_key'   => (string) $order->get_order_key(),
        'amount'      => (float) $order->get_total(),
        'currency'    => (string) $order->get_currency(),
        'lang'        => (string) ( function_exists( 'determine_locale' ) ? determine_locale() : get_locale() ),
        'success_url' => (string) $order->get_checkout_order_received_url(),
        'failure_url' => (string) ( $order->get_meta( '_cup_skip_checkout' ) === 'yes' ? add_query_arg( 'cup_failed', '1', wc_get_cart_url() ) : wc_get_checkout_url() ),
        'site_a'      => home_url(),
        'billing'     => [
            'first_name' => (string) $order->get_billing_first_name(),
            'last_name'  => (string) $order->get_billing_last_name(),
            'company'    => (string) $order->get_billing_company(),
            'address_1'  => (string) $order->get_billing_address_1(),
            'address_2'  => (string) $order->get_billing_address_2(),
            'city'       => (string) $order->get_billing_city(),
            'postcode'   => (string) $order->get_billing_postcode(),
            'country'    => (string) $order->get_billing_country(),
            'state'      => (string) $order->get_billing_state(),
            'email'      => (string) $order->get_billing_email(),
            'phone'      => (string) $order->get_billing_phone(),
        ],
        'nonce'       => bin2hex( random_bytes( 16 ) ),
        'iat'         => time(),
        'exp'         => time() + CUP_TOKEN_TTL,
    ];

    if ( $order->get_meta( '_cup_skip_checkout' ) === 'yes' ) {
        $payload['collect_customer_details'] = true;
        $payload['needs_shipping'] = (bool) $order->get_meta( '_cup_needs_shipping' );
    }

    if ( ( $opts['send_order_preview'] ?? 'no' ) === 'yes' ) {
        $preview = cup_order_preview( $order );
        if ( $preview ) $payload['order_preview'] = $preview;
    }
    $token = cup_encrypt_token( $payload );
    if ( $token === '' ) {
        return [ 'error' => 'Kon de beveiligde token niet genereren. (OpenSSL/AES-GCM nodig op de server.)' ];
    }

    if ( cup_session_insert( $token, (int) $order->get_id(), (float) $payload['amount'], (string) $payload['currency'], $payload, $site_index, $base ) !== 1 ) {
        return [ 'error' => 'De betaaloverdracht kon niet worden opgeslagen. Probeer opnieuw.' ];
    }
    $url = ( $opts['handover_transport'] ?? 'legacy' ) === 'short'
        ? cup_short_handover_url( $token, $base, (int) $payload['exp'] )
        : $base . '/?t=' . rawurlencode( $token );
    if ( is_wp_error( $url ) ) return [ 'error' => $url->get_error_message() ];

    $order->update_meta_data( '_cup_token_hash', hash( 'sha256', $token ) );
    $order->update_meta_data( '_cup_site_index', $site_index );
    $order->update_meta_data( '_cup_site_url',   $base );
    $order->update_status( 'pending', sprintf( 'Klant doorgestuurd naar Site B #%d (%s).', $site_index, $base ) );
    $order->save();

    cbr_timing( 'a_build_link', $timing_start, (int) $order->get_id() );
    return [ 'url' => $url ];
}

/* =====================================================================
 * REST: confirm callback from Site B (HMAC-signed)
 * URL: /wp-json/cup/v1/confirm
 * Body: { token_hash, status, b_order_id?, amount?, currency?, ts, sig }
 * sig = HMAC-SHA256(secret_mac, token_hash + '|' + status + '|' + ts)
 * ===================================================================== */
add_action( 'rest_api_init', function () {
    register_rest_route( 'cup/v1', '/confirm', [
        'methods'             => 'POST',
        'callback'            => 'cup_rest_confirm',
        'permission_callback' => '__return_true',
    ] );
});

function cup_rest_confirm( WP_REST_Request $req ) {
    [ , $mac_key ] = cup_derive_keys();
    if ( $mac_key === '' ) {
        return new WP_Error( 'config', 'Plugin niet geconfigureerd.', [ 'status' => 500 ] );
    }
    $p = $req->get_json_params();
    if ( ! is_array( $p ) ) $p = [];

    $token_hash = isset( $p['token_hash'] ) ? (string) $p['token_hash'] : '';
    $status     = isset( $p['status'] )     ? (string) $p['status']     : '';
    $ts         = isset( $p['ts'] )         ? (int)    $p['ts']         : 0;
    $sig        = isset( $p['sig'] )        ? (string) $p['sig']        : '';

    if ( ! preg_match( '/^[a-f0-9]{64}$/', $token_hash ) ) {
        return new WP_Error( 'bad_token', 'Ongeldig token hash.', [ 'status' => 400 ] );
    }
    if ( ! in_array( $status, [ 'paid', 'failed', 'cancelled' ], true ) ) {
        return new WP_Error( 'bad_status', 'Ongeldige status.', [ 'status' => 400 ] );
    }
    if ( $ts <= 0 || abs( time() - $ts ) > 15 * MINUTE_IN_SECONDS ) {
        return new WP_Error( 'stale', 'Verzoek te oud of klok mismatch.', [ 'status' => 400 ] );
    }
    $expected = hash_hmac( 'sha256', $token_hash . '|' . $status . '|' . $ts, $mac_key );
    if ( ! hash_equals( $expected, $sig ) ) {
        return new WP_Error( 'auth', 'Ongeldige handtekening.', [ 'status' => 403 ] );
    }

    $row = cup_session_get_by_token_hash( $token_hash );
    if ( ! $row ) {
        return new WP_Error( 'not_found', 'Sessie niet gevonden.', [ 'status' => 404 ] );
    }
    $order = wc_get_order( (int) $row->order_id );
    if ( ! $order ) {
        return new WP_Error( 'no_order', 'Order niet gevonden.', [ 'status' => 404 ] );
    }

    if ( $status === 'paid' ) {
        if ( $order->get_meta( '_cup_skip_checkout' ) === 'yes' ) {
            $customer_result = cup_direct_receive_customer( $order, $p, $mac_key );
            if ( is_wp_error( $customer_result ) ) return $customer_result;
        }
        cup_mark_order_paid( $order, 'webhook' );
        global $wpdb;
        $wpdb->update( $wpdb->prefix . CUP_TABLE, [
            'status' => 'paid', 'updated_at' => current_time( 'mysql' ), 'confirmed_at' => current_time( 'mysql' ),
        ], [ 'token_hash' => $token_hash ], [ '%s', '%s', '%s' ], [ '%s' ] );
    } elseif ( $status === 'failed' ) {
        if ( $order->has_status( [ 'pending', 'on-hold' ] ) ) {
            $order->update_status( 'failed', 'Betaling mislukt (Site B webhook).' );
        }
        global $wpdb;
        $wpdb->update( $wpdb->prefix . CUP_TABLE, [
            'status' => 'failed', 'updated_at' => current_time( 'mysql' ),
        ], [ 'token_hash' => $token_hash ], [ '%s', '%s' ], [ '%s' ] );
    } elseif ( $status === 'cancelled' ) {
        global $wpdb;
        $wpdb->update( $wpdb->prefix . CUP_TABLE, [
            'status' => 'cancelled', 'updated_at' => current_time( 'mysql' ),
        ], [ 'token_hash' => $token_hash ], [ '%s', '%s' ], [ '%s' ] );
    }

    return new WP_REST_Response( [ 'success' => true ], 200 );
}

function cup_mark_order_paid( $order, string $source = 'webhook' ) {
    if ( ! $order ) return;
    if ( $order->has_status( [ 'processing', 'completed' ] ) ) return;
    $order->payment_complete();
    $order->add_order_note( 'Betaling bevestigd via ' . sanitize_text_field( $source ) . ' (Cart Upsell Pro).' );
}

/**
 * Keep paid Cart Upsell Pro orders on "processing" until fulfilment.
 * Triggered via the woocommerce_payment_complete_order_status filter.
 */
add_filter( 'woocommerce_payment_complete_order_status', function ( $status, $order_id, $order ) {
    if ( ! $order ) $order = wc_get_order( $order_id );
    if ( ! $order ) return $status;
    if ( $order->get_payment_method() !== CUP_GATEWAY_ID ) return $status;
    return 'processing';
}, 10, 3 );

/* =====================================================================
 * Secondary signed token: customer-borne fallback.
 * Site B appends ?cup_p=<token_hash>.<ts>.<sig> to its redirect back to
 * Site A's thankyou. Site A verifies and marks paid if not already paid.
 * ===================================================================== */
add_action( 'template_redirect', function () {
    if ( is_admin() ) return;
    if ( empty( $_GET['cup_p'] ) ) return;
    if ( ! function_exists( 'is_wc_endpoint_url' ) || ! is_wc_endpoint_url( 'order-received' ) ) return;

    $raw = (string) $_GET['cup_p'];
    $parts = explode( '.', $raw );
    if ( count( $parts ) !== 3 ) return;
    [ $token_hash, $ts, $sig ] = $parts;
    if ( ! preg_match( '/^[a-f0-9]{64}$/', $token_hash ) ) return;
    $ts = (int) $ts;
    if ( abs( time() - $ts ) > 30 * MINUTE_IN_SECONDS ) return;

    [ , $mac_key ] = cup_derive_keys();
    if ( $mac_key === '' ) return;
    $expected = hash_hmac( 'sha256', $token_hash . '|paid|' . $ts, $mac_key );
    if ( ! hash_equals( $expected, $sig ) ) return;

    $row = cup_session_get_by_token_hash( $token_hash );
    if ( ! $row ) return;
    $order = wc_get_order( (int) $row->order_id );
    if ( ! $order ) return;

    if ( ! $order->has_status( [ 'processing', 'completed' ] ) ) {
        cup_mark_order_paid( $order, 'signed redirect' );
        global $wpdb;
        $wpdb->update( $wpdb->prefix . CUP_TABLE, [
            'status' => 'paid', 'updated_at' => current_time( 'mysql' ), 'confirmed_at' => current_time( 'mysql' ),
        ], [ 'token_hash' => $token_hash ], [ '%s', '%s', '%s' ], [ '%s' ] );
    }
}, 5 );

/* =====================================================================
 * Thankyou UI: show pending-friendly notice if status not yet paid
 * ===================================================================== */
add_action( 'woocommerce_thankyou', function ( $order_id ) {
    if ( ! $order_id ) return;
    $order = wc_get_order( $order_id );
    if ( ! $order ) return;
    if ( $order->get_payment_method() !== CUP_GATEWAY_ID ) return;
    if ( $order->has_status( [ 'processing', 'completed' ] ) ) {
        // Cart leegmaken in deze sessie
        if ( function_exists( 'WC' ) && WC()->cart ) WC()->cart->empty_cart();
        return;
    }
    if ( $order->has_status( [ 'pending', 'on-hold' ] ) ) {
        ?>
        <style>
            .agv2-pending { padding:1.5em; margin:1em 0 2em; text-align:center; background:#fff8e1; border-left:4px solid #ffb300; border-radius:4px; }
            .agv2-pending h2 { margin:0 0 .4em; }
        </style>
        <div class="agv2-pending">
            <h2>Betalingsstatus wordt bijgewerkt&hellip;</h2>
            <p>We bevestigen je betaling. Deze pagina ververst zichzelf.</p>
        </div>
        <script>setTimeout(function(){ location.reload(); }, 5000);</script>
        <?php
    }
}, 1, 1 );

/* =====================================================================
 * Privacy headers on checkout
 * ===================================================================== */
add_action( 'send_headers', function () {
    if ( is_admin() ) return;
    if ( function_exists( 'is_checkout' ) && ( is_checkout() || ( function_exists( 'is_wc_endpoint_url' ) && is_wc_endpoint_url( 'order-pay' ) ) ) ) {
        @header( 'Referrer-Policy: no-referrer' );
    }
});
add_action( 'wp_head', function () {
    if ( is_admin() ) return;
    if ( function_exists( 'is_checkout' ) && ( is_checkout() || ( function_exists( 'is_wc_endpoint_url' ) && is_wc_endpoint_url( 'order-pay' ) ) ) ) {
        echo "\n<meta name=\"referrer\" content=\"no-referrer\" />\n";
    }
}, 1 );

/* =====================================================================
 * Rey theme compat: schakel AJAX-navigatie uit op checkout
 * ===================================================================== */
add_filter( 'reycore/ajax_navigation/enabled', function ( $e ) {
    if ( function_exists( 'is_checkout' ) && is_checkout() ) return false;
    return $e;
});
add_action( 'wp_enqueue_scripts', function () {
    if ( function_exists( 'is_checkout' ) && is_checkout() ) {
        wp_dequeue_script( 'rey-ajax-navigation' );
    }
}, 99 );

/* =====================================================================
 * Failure notice on checkout when user returns from Site B with error
 * ===================================================================== */
add_action( 'woocommerce_before_checkout_form', function () {
    if ( ! empty( $_GET['cup_failed'] ) ) {
        wc_print_notice( '<strong>Betaling mislukt of geannuleerd.</strong> Probeer opnieuw.', 'error' );
    }
}, 10 );

/* =====================================================================
 * Cleanup: cron to expire stale sessions
 * ===================================================================== */
register_activation_hook( __FILE__, function () {
    if ( ! wp_next_scheduled( 'cup_cleanup_sessions' ) ) {
        wp_schedule_event( time() + HOUR_IN_SECONDS, 'hourly', 'cup_cleanup_sessions' );
    }
});
register_deactivation_hook( __FILE__, function () {
    $t = wp_next_scheduled( 'cup_cleanup_sessions' );
    if ( $t ) wp_unschedule_event( $t, 'cup_cleanup_sessions' );
});
add_action( 'cup_cleanup_sessions', function () {
    global $wpdb;
    $table  = $wpdb->prefix . CUP_TABLE;
    $rtable = $wpdb->prefix . CUP_ROUTES_TABLE;
    // expire created/pending sessions older than expires_at
    $wpdb->query( "UPDATE $table SET status='expired', updated_at=UTC_TIMESTAMP() WHERE status IN ('created','pending') AND expires_at < UTC_TIMESTAMP()" );
    // delete sessions older than 90 days
    $wpdb->query( "DELETE FROM $table WHERE created_at < (UTC_TIMESTAMP() - INTERVAL 90 DAY)" );
    // delete IP-routes not seen for 180 days (keeps DB lean while preserving long sticky)
    $wpdb->query( "DELETE FROM $rtable WHERE last_seen < (UTC_TIMESTAMP() - INTERVAL 180 DAY)" );
});

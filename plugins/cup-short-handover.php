<?php
if ( ! defined( 'ABSPATH' ) ) exit;
require_once __DIR__ . '/bridge-wire.php';

function cup_handover_install(): void {
    global $wpdb;
    $table = $wpdb->prefix . 'cup_handoffs';
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta( "CREATE TABLE $table (
        code_hash CHAR(64) NOT NULL,
        token LONGTEXT NOT NULL,
        destination VARCHAR(255) NOT NULL,
        expires BIGINT(20) UNSIGNED NOT NULL,
        PRIMARY KEY (code_hash),
        KEY expires (expires)
    ) " . $wpdb->get_charset_collate() . ';' );
    if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $table ) ) ) === $table ) {
        update_option( 'cup_handover_schema', '1', false );
    }
}
register_activation_hook( CUP_PLUGIN_FILE, 'cup_handover_install' );
add_action( 'init', function () {
    if ( get_option( 'cup_handover_schema' ) !== '1' ) cup_handover_install();
    if ( ! wp_next_scheduled( 'cup_handover_cleanup' ) ) wp_schedule_event( time() + HOUR_IN_SECONDS, 'hourly', 'cup_handover_cleanup' );
}, 2 );
add_action( 'cup_handover_cleanup', function () {
    global $wpdb;
    $wpdb->query( $wpdb->prepare( 'DELETE FROM ' . $wpdb->prefix . 'cup_handoffs WHERE expires < %d', time() ) );
} );
register_deactivation_hook( CUP_PLUGIN_FILE, function () { wp_clear_scheduled_hook( 'cup_handover_cleanup' ); } );

function cup_short_handover_url( string $token, string $destination, int $expires ) {
    global $wpdb;
    $origin = cbr_origin( home_url() );
    $destination = cbr_origin( $destination );
    if ( $origin === '' || $destination === '' ) return new WP_Error( 'handover_https', 'Korte betaallinks vereisen HTTPS op beide sites.' );
    $code = cbr_letters( bin2hex( random_bytes( 24 ) ) );
    $ok = $wpdb->insert( $wpdb->prefix . 'cup_handoffs', [
        'code_hash' => hash( 'sha256', $code ), 'token' => $token,
        'destination' => $destination, 'expires' => $expires,
    ], [ '%s', '%s', '%s', '%d' ] );
    if ( $ok !== 1 ) return new WP_Error( 'handover_storage', 'De betaallink kon niet worden opgeslagen. Probeer opnieuw.' );
    // Build this security-sensitive browser URL explicitly. This avoids HTML
    // entity/query encoding from filters turning the destination into an URL
    // Safari cannot display.
    return $destination . '/?sio_ref=' . rawurlencode( $code ) . '&sio_origin=' . rawurlencode( cbr_origin_id( $origin ) );
}

function cup_handover_auth( WP_REST_Request $req ) {
    $p = $req->get_json_params();
    if ( ! is_array( $p ) || ! is_string( $p['code'] ?? null ) || ! preg_match( '/^[g-v]{48}$/D', $p['code'] )
        || ! is_string( $p['destination'] ?? null ) || cbr_origin( $p['destination'] ) !== $p['destination'] || $p['destination'] === ''
        || ! is_int( $p['ts'] ?? null ) || abs( time() - $p['ts'] ) > 120
        || ! is_string( $p['sig'] ?? null ) || ! preg_match( '/^[a-f0-9]{64}$/D', $p['sig'] ) ) {
        return new WP_Error( 'handover_auth', 'Ongeldig overdrachtsverzoek.', [ 'status' => 403 ] );
    }
    [ , $key ] = cup_derive_keys();
    $expected = cbr_signature( $key, [ 'fetch-v1', $p['code'], $p['destination'], (string) $p['ts'] ] );
    return $key !== '' && hash_equals( $expected, $p['sig'] ) ? true
        : new WP_Error( 'handover_auth', 'Ongeldig overdrachtsverzoek.', [ 'status' => 403 ] );
}

function cup_handover_fetch( WP_REST_Request $req ) {
    // Also enforce when invoked outside the REST dispatcher.
    $auth = cup_handover_auth( $req );
    if ( is_wp_error( $auth ) ) return $auth;
    global $wpdb;
    $p = $req->get_json_params();
    $row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . $wpdb->prefix . 'cup_handoffs WHERE code_hash=%s', hash( 'sha256', $p['code'] ) ) );
    if ( ! $row || (int) $row->expires <= time() || ! hash_equals( $row->destination, $p['destination'] ) ) {
        return new WP_Error( 'handover_missing', 'Betaallink ongeldig of verlopen.', [ 'status' => 410 ] );
    }
    [ , $key ] = cup_derive_keys();
    $origin = cbr_origin( home_url() );
    $response = new WP_REST_Response( [
        'token' => $row->token,
        'sig' => cbr_signature( $key, [ 'reply-v1', $p['code'], $origin, $p['destination'], $row->token ] ),
    ], 200 );
    $response->header( 'Cache-Control', 'no-store, private, max-age=0' );
    $response->header( 'Pragma', 'no-cache' );
    return $response;
}
add_action( 'rest_api_init', function () {
    register_rest_route( 'cup/v1', '/handover', [
        'methods' => 'POST', 'callback' => 'cup_handover_fetch', 'permission_callback' => 'cup_handover_auth',
    ] );
} );

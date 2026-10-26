<?php
/** Optional cart-to-Site-B handover. The ordinary gateway flow stays opt-in separately. */
if ( ! defined( 'ABSPATH' ) ) exit;

function cup_skip_checkout_enabled(): bool {
    $opts = get_option( 'woocommerce_' . CUP_GATEWAY_ID . '_settings', [] );
    return ( $opts['skip_checkout'] ?? 'no' ) === 'yes' && ( $opts['enabled'] ?? 'yes' ) === 'yes';
}

/** Build from the server-side cart, never from an amount supplied in a URL. */
function cup_build_cart_redirect(): array {
    $start = microtime( true );
    register_shutdown_function( function () use ( $start ) { cbr_timing( 'a_cart_to_response', $start ); } );
    if ( ! WC()->cart || ! WC()->session || WC()->cart->is_empty() ) {
        return [ 'error' => 'Je winkelwagen is leeg.' ];
    }

    try {
        $cart_start = microtime( true );
        WC()->cart->calculate_totals();
        cbr_timing( 'a_calculate_cart', $cart_start );
        do_action( 'woocommerce_check_cart_items' );
        if ( wc_notice_count( 'error' ) ) {
            return [ 'error' => 'Controleer je winkelwagen voordat je verdergaat.' ];
        }

        $opts = get_option( 'woocommerce_' . CUP_GATEWAY_ID . '_settings', [] );
        $fingerprint = hash( 'sha256', wp_json_encode( [
            WC()->cart->get_cart_hash(), get_woocommerce_currency(),
            WC()->session->get( 'chosen_shipping_methods' ), $opts,
        ] ) );
        $previous = WC()->session->get( 'cup_direct_checkout', [] );
        $order = null;
        if ( is_array( $previous ) && ( $previous['fingerprint'] ?? '' ) === $fingerprint ) {
            $candidate = wc_get_order( (int) ( $previous['order_id'] ?? 0 ) );
            if ( $candidate && $candidate->has_status( 'pending' )
                && $candidate->get_meta( '_cup_skip_checkout' ) === 'yes'
                && $candidate->get_payment_method() === CUP_GATEWAY_ID
                && (int) $candidate->get_customer_id() === get_current_user_id()
                && $candidate->has_cart_hash( WC()->cart->get_cart_hash() ) ) {
                $order = $candidate;
                $row = cup_session_get_by_token_hash( (string) $order->get_meta( '_cup_token_hash' ) );
                if ( ! empty( $previous['url'] ) && (int) ( $previous['expires'] ?? 0 ) > time() + 60
                    && $row && $row->status === 'created' ) {
                    return [ 'url' => $previous['url'] ];
                }
            }
        }

        if ( ! $order ) {
            // Do not resume or overwrite an order made through the ordinary checkout.
            $awaiting = WC()->session->get( 'order_awaiting_payment' );
            WC()->session->set( 'order_awaiting_payment', null );
            try {
                $create_start = microtime( true );
                $order_id = WC()->checkout()->create_order( [ 'payment_method' => CUP_GATEWAY_ID ] );
                cbr_timing( 'a_create_order', $create_start, is_wp_error( $order_id ) ? 0 : (int) $order_id );
            } finally {
                WC()->session->set( 'order_awaiting_payment', $awaiting );
            }
            if ( is_wp_error( $order_id ) ) return [ 'error' => $order_id->get_error_message() ];
            $order = wc_get_order( $order_id );
            if ( ! $order ) return [ 'error' => 'De bestelling kon niet worden aangemaakt. Probeer opnieuw.' ];
            $order->update_meta_data( '_cup_skip_checkout', 'yes' );
            $order->update_meta_data( '_cup_needs_shipping', WC()->cart->needs_shipping() ? 1 : 0 );
            $order->save();
        }

        // Store the order even if token generation fails, so retries can reuse it.
        WC()->session->set( 'cup_direct_checkout', [
            'fingerprint' => $fingerprint, 'order_id' => $order->get_id(),
        ] );
        $result = cup_build_redirect( $order );
        if ( ! isset( $result['error'] ) ) {
            WC()->session->set( 'cup_direct_checkout', [
                'fingerprint' => $fingerprint, 'order_id' => $order->get_id(),
                'url' => $result['url'], 'expires' => time() + CUP_TOKEN_TTL,
            ] );
        }
        return $result;
    } catch ( Throwable $e ) {
        wc_get_logger()->error( $e->getMessage(), [ 'source' => 'cup-direct-checkout' ] );
        return [ 'error' => 'Doorsturen naar de betaalpagina is niet gelukt. Probeer opnieuw.' ];
    }
}

// Catches normal, hard-coded, block checkout and directly opened checkout URLs
// before either checkout form is rendered. Payment/thank-you endpoints stay intact.
add_action( 'template_redirect', function () {
    if ( is_admin() || wp_doing_ajax() || ! cup_skip_checkout_enabled() ) return;
    if ( ! function_exists( 'is_checkout' ) || ! is_checkout() || is_wc_endpoint_url() ) return;
    if ( ! in_array( strtoupper( $_SERVER['REQUEST_METHOD'] ?? 'GET' ), [ 'GET', 'POST' ], true ) ) return;
    nocache_headers();
    header( 'Referrer-Policy: no-referrer' );

    // A failed payment must not immediately start another payment attempt.
    if ( ! empty( $_GET['cup_failed'] ) ) {
        wp_safe_redirect( add_query_arg( 'cup_failed', '1', wc_get_cart_url() ) );
        exit;
    }
    $result = cup_build_cart_redirect();
    if ( isset( $result['error'] ) ) {
        wc_add_notice( $result['error'], 'error' );
        wp_safe_redirect( wc_get_cart_url() );
    } else {
        // External destination comes exclusively from the administrator's settings.
        wp_redirect( $result['url'], 303, 'Cart Upsell Pro' );
    }
    exit;
}, 1 );

add_action( 'wp_enqueue_scripts', function () {
    if ( ! cup_skip_checkout_enabled() || ! function_exists( 'wc_get_checkout_url' ) ) return;
    $path = __DIR__ . '/cup-direct-checkout.js';
    wp_enqueue_script( 'cup-direct-checkout', plugin_dir_url( __FILE__ ) . 'cup-direct-checkout.js', [], filemtime( $path ), true );
    wp_localize_script( 'cup-direct-checkout', 'cupDirectCheckout', [ 'checkoutUrl' => wc_get_checkout_url() ] );
} );

// Covers classic and block carts without depending on a classic-cart template hook.
add_action( 'template_redirect', function () {
    if ( function_exists( 'is_cart' ) && is_cart() && ! empty( $_GET['cup_failed'] ) ) {
        $message = 'Betaling mislukt of geannuleerd. Je winkelwagen is bewaard; probeer opnieuw.';
        if ( ! wc_has_notice( $message, 'error' ) ) wc_add_notice( $message, 'error' );
    }
}, 5 );

/** Customer data has its own signature; the original payment signature stays compatible. */
function cup_direct_receive_customer( $order, array $body, string $mac_key ) {
    $json = $body['customer_data'] ?? '';
    $sig = $body['customer_sig'] ?? '';
    if ( ! is_string( $json ) || strlen( $json ) > 16384 || ! is_string( $sig ) ) {
        return new WP_Error( 'customer_data', 'Ongeldige klantgegevens.', [ 'status' => 400 ] );
    }
    $expected = hash_hmac( 'sha256', $body['token_hash'] . '|customer|' . $body['ts'] . '|' . $json, $mac_key );
    if ( $json === '' || ! hash_equals( $expected, $sig ) ) {
        return new WP_Error( 'customer_auth', 'Klantgegevens ontbreken of handtekening ongeldig.', [ 'status' => 403 ] );
    }
    $data = json_decode( $json, true );
    if ( ! is_array( $data ) || ! is_numeric( $data['amount'] ?? null )
        || wc_format_decimal( $data['amount'], wc_get_price_decimals() ) !== wc_format_decimal( $order->get_total(), wc_get_price_decimals() )
        || ( $data['currency'] ?? '' ) !== $order->get_currency()
        || ! is_array( $data['billing'] ?? null ) || ! is_array( $data['shipping'] ?? null ) ) {
        return new WP_Error( 'customer_mismatch', 'Bedrag, valuta of klantgegevens komen niet overeen.', [ 'status' => 400 ] );
    }
    if ( ! is_string( $data['billing']['email'] ?? null ) || ! is_email( $data['billing']['email'] ) ) {
        return new WP_Error( 'customer_email', 'Ongeldig e-mailadres.', [ 'status' => 400 ] );
    }
    // A repeated webhook must not overwrite later merchant edits.
    if ( $order->get_meta( '_cup_customer_received' ) !== 'yes' ) {
        $addresses = [];
        foreach ( [ 'billing', 'shipping' ] as $type ) {
            $address = [];
            $keys = [ 'first_name', 'last_name', 'company', 'address_1', 'address_2', 'city', 'postcode', 'country', 'state', 'phone' ];
            if ( $type === 'billing' ) $keys[] = 'email';
            foreach ( $keys as $key ) {
                $value = $data[ $type ][ $key ] ?? '';
                if ( ! is_string( $value ) ) return new WP_Error( 'customer_field', 'Ongeldig adresveld.', [ 'status' => 400 ] );
                $address[ $key ] = $key === 'email' ? sanitize_email( $value ) : sanitize_text_field( $value );
            }
            $addresses[ $type ] = $address;
        }
        foreach ( $addresses as $type => $address ) $order->set_address( $address, $type );
        $order->update_meta_data( '_cup_customer_received', 'yes' );
        $order->save();
    }
    return true;
}

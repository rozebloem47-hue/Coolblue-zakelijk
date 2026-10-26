<?php
/** Shared short-reference protocol. Keep identical in both plugin packages. */
if ( ! defined( 'ABSPATH' ) ) exit;
if ( ! defined( 'CBR_WIRE_LOADED' ) ) {
define( 'CBR_WIRE_LOADED', true );

function cbr_letters( string $hex ): string {
    return strtr( $hex, '0123456789abcdef', 'ghijklmnopqrstuv' );
}

function cbr_origin( string $url ): string {
    $p = wp_parse_url( trim( $url ) );
    if ( ! is_array( $p ) || strtolower( $p['scheme'] ?? '' ) !== 'https' || empty( $p['host'] )
        || isset( $p['user'] ) || isset( $p['pass'] ) || isset( $p['query'] ) || isset( $p['fragment'] ) ) return '';
    $path = rtrim( $p['path'] ?? '', '/' );
    if ( preg_match( '#(?:^|/)\.{1,2}(?:/|$)|%|\\\\#', $path ) ) return '';
    $port = isset( $p['port'] ) && (int) $p['port'] !== 443 ? ':' . $p['port'] : '';
    return 'https://' . strtolower( $p['host'] ) . $port . $path;
}

function cbr_origin_id( string $origin ): string {
    return cbr_letters( substr( hash( 'sha256', $origin ), 0, 32 ) );
}

function cbr_signature( string $key, array $parts ): string {
    return hash_hmac( 'sha256', implode( "\n", $parts ), $key );
}

/** Only timings and numeric order IDs; never URLs, tokens or customer data. */
function cbr_timing( string $stage, float $start, int $order_id = 0 ): void {
    if ( ! function_exists( 'wc_get_logger' ) || ! apply_filters( 'cbr_timing_enabled', true ) ) return;
    wc_get_logger()->info( wp_json_encode( [
        'stage' => $stage, 'ms' => (int) round( ( microtime( true ) - $start ) * 1000 ),
        'order_id' => $order_id,
    ] ), [ 'source' => 'bridge-timing' ] );
}

} // Shared functions may already be loaded by the companion plugin.

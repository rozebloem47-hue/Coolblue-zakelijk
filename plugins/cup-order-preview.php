<?php
/** Optional display-only order snapshot. Never changes payment calculations. */
if (!defined('ABSPATH')) exit;
function cup_order_preview($order) {
    $items = [];
    foreach ($order->get_items('line_item') as $item) {
        $product = $item->get_product();
        $image_id = $product ? $product->get_image_id() : 0;
        if (!$image_id && $product && $product->get_parent_id()) {
            $parent = wc_get_product($product->get_parent_id());
            $image_id = $parent ? $parent->get_image_id() : 0;
        }
        $details = [];
        foreach ($item->get_formatted_meta_data('_', true) as $meta) {
            $details[] = ['label' => wp_strip_all_tags((string)$meta->display_key), 'value' => wp_strip_all_tags((string)$meta->display_value)];
        }
        $qty = (float)$item->get_quantity();
        $line = (float)$item->get_total() + (float)$item->get_total_tax();
        $items[] = ['title' => wp_strip_all_tags($item->get_name()), 'image' => $image_id ? (string)wp_get_attachment_image_url($image_id, 'woocommerce_thumbnail') : '', 'quantity' => $qty, 'unit' => $qty > 0 ? $line / $qty : 0, 'total' => $line, 'subtotal' => (float)$item->get_subtotal() + (float)$item->get_subtotal_tax(), 'details' => $details];
    }
    $fees = [];
    foreach ($order->get_items('fee') as $fee) $fees[] = ['label'=>wp_strip_all_tags($fee->get_name()), 'total'=>(float)$fee->get_total()+(float)$fee->get_total_tax()];
    $data = ['version'=>1, 'shop'=>wp_strip_all_tags(get_bloginfo('name')), 'order_number'=>(string)$order->get_order_number(), 'currency'=>$order->get_currency(), 'items'=>$items, 'fees'=>$fees, 'shipping'=>(float)$order->get_shipping_total()+(float)$order->get_shipping_tax(), 'discount'=>(float)$order->get_discount_total()+(float)$order->get_discount_tax(), 'tax'=>(float)$order->get_total_tax(), 'total'=>(float)$order->get_total()];
    // Bound the optional snapshot to leave room inside the existing transport limit.
    return strlen(wp_json_encode($data)) <= 24000 ? $data : null;
}

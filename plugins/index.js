/**
 * Cart Upsell Pro — checkout hardening
 *
 * Doel: zorg dat ALS de gekozen betaalmethode "cart_upsell_pro" is, de
 * redirect uit de Woo checkout response *hard* gevolgd wordt, ook al
 * probeert een theme (Rey, etc.) AJAX-navigation toe te passen of de
 * response te onderscheppen. Dit is een defensieve laag bovenop de
 * standaard Woo flow.
 */
(function ($) {
    'use strict';

    function isOurGateway() {
        try {
            // classic checkout
            var classic = document.querySelector('input[name="payment_method"]:checked');
            if (classic && classic.value === 'cart_upsell_pro') return true;
            // block checkout (radio-control)
            var block = document.querySelector('input[name="radio-control-wc-payment-method-options"]:checked');
            if (block && block.value === 'cart_upsell_pro') return true;
        } catch (e) {}
        return false;
    }

    var recovering = false;

    function recoverSuccessfulRedirect() {
        // Do not depend on a visible/selected gateway here. Two-step themes can
        // remove the payment controls before emitting checkout_error. The
        // server endpoint performs the authoritative session/order checks.
        if (recovering) return;
        if (!window.cupCheckoutRecovery || !window.cupCheckoutRecovery.url) return;

        recovering = true;
        $.ajax({
            url: window.cupCheckoutRecovery.url,
            method: 'GET',
            dataType: 'json',
            cache: false
        }).done(function (response) {
            var redirect = response && response.success && response.data && response.data.redirect;
            if (!redirect) {
                recovering = false;
                return;
            }
            window.top.location.replace(redirect);
        }).fail(function () {
            recovering = false;
        });
    }

    // Catch Woo's checkout AJAX response and force a hard top-level redirect.
    $(document).ajaxComplete(function (evt, xhr, settings) {
        try {
            var url = (settings && settings.url) ? String(settings.url) : '';
            if (url.indexOf('wc-ajax=checkout') === -1 && url.indexOf('wc-ajax=update_order_review') !== -1) return;
            if (url.indexOf('wc-ajax=checkout') === -1) return;

            var data;
            try {
                data = xhr.responseJSON;
                if (!data) data = JSON.parse(xhr.responseText || 'null');
            } catch (e) {
                window.setTimeout(recoverSuccessfulRedirect, 0);
                return;
            }
            if (!data || data.result !== 'success' || !data.redirect) {
                window.setTimeout(recoverSuccessfulRedirect, 0);
                return;
            }

            // Force hard navigate — bypass any AJAX-navigation interceptors.
            window.top.location.href = data.redirect;
        } catch (e) { /* noop */ }
    });

    // Woo can show its generic error even though process_payment succeeded.
    // In that case recover the redirect from the current Woo session.
    $(document.body).on('checkout_error', function () {
        window.setTimeout(recoverSuccessfulRedirect, 0);
    });

    $(document).ajaxError(function (evt, xhr, settings) {
        var url = (settings && settings.url) ? String(settings.url) : '';
        if (url.indexOf('wc-ajax=checkout') === -1) return;
        window.setTimeout(recoverSuccessfulRedirect, 0);
    });

    // Prevent double-click on place_order while submission is in flight.
    var submitting = false;
    $(document).on('click', '#place_order', function () {
        if (!isOurGateway()) return;
        if (submitting) return false;
        submitting = true;
        setTimeout(function () { submitting = false; }, 4000);
    });

})(jQuery);

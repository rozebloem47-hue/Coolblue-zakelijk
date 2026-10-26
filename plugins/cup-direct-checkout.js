/* Force checkout links to load as a full page, including links in AJAX mini-carts. */
(function () {
    'use strict';
    if (typeof cupDirectCheckout === 'undefined') return;
    var checkout = new URL(cupDirectCheckout.checkoutUrl, window.location.href);
    function isCheckout(url) {
        if (url.origin !== checkout.origin) return false;
        if (url.pathname.replace(/\/+$/, '') !== checkout.pathname.replace(/\/+$/, '')) return false;
        // Also supports WordPress plain permalinks (?page_id=...).
        var matches = true;
        checkout.searchParams.forEach(function (value, key) {
            if (url.searchParams.get(key) !== value) matches = false;
        });
        return matches && !url.searchParams.has('order-pay') && !url.searchParams.has('order-received');
    }
    document.addEventListener('click', function (event) {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        var link = event.target.closest && event.target.closest('a[href]');
        if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
        var target;
        try { target = new URL(link.href, window.location.href); } catch (e) { return; }
        if (!isCheckout(target)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        window.location.assign(target.href);
    }, true);
}());

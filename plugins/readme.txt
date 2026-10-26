=== Cart Upsell Pro ===
Contributors: pluginauthor
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 3.6.9
License: GPL-2.0+

Slimme cart upsell met IP-sticky load balancing en custom checkout opties.

== Installatie ==

1. Plugins → Nieuwe plugin → Plugin uploaden → kies cart-upsell-pro.zip.
2. Activeer.
3. WooCommerce → Instellingen → Betalingen → "Cart Upsell Pro".
4. Vul de instellingen in (URL's, secret, sticky-venster).

== Wijzigingen ==

= 3.6.9 =
* Combineert de door het tweestapsthema geaccepteerde lokale route met de gecorrigeerde korte Site B-link.
* De lokale route geeft onmiddellijk een serverredirect zonder zichtbare tussenpagina, tekst, knop, thema of trackingpixel.

= 3.6.8 =
* Verwijdert de zichtbare tussenpagina volledig; de checkout stuurt weer direct naar Site B.
* Bouwt de korte HTTPS-link strikt en expliciet op zodat Safari geen ongeldige querycodering meer ontvangt.

= 3.6.7 =
* Gebruikt naast JavaScript ook browser-native automatische doorsturing voor Safari en toont een Engelse fallbackknop.
* Houdt de tijdelijke sessielink kort beschikbaar zodat vernieuwen opnieuw kan doorsturen wanneer de eerste navigatie wordt onderbroken.

= 3.6.6 =
* Vervangt de externe HTTP-redirectketen door een minimale lokale doorstuurpagina voor Safari-compatibiliteit.
* De tussenpagina laadt geen thema, analytics of trackingpixels en navigeert alleen naar de server-side gevalideerde Site B-link.

= 3.6.5 =
* Stuurt de tweestaps-checkout eerst via een eenmalige URL op Site A en daarna server-side door naar Site B. Het thema hoeft daardoor geen externe betaalredirect meer te verwerken.
* De lokale tussenstap levert geen pagina-inhoud of trackingpixel, gebruikt een sessiegebonden sleutel en controleert bestelling, betaalmethode, geldigheid en Site B opnieuw.

= 3.6.4 =
* Werkt ook met tweestaps-checkouts die de geselecteerde betaalmethode verbergen of verwijderen voordat zij de algemene WooCommerce-fout tonen.
* Probeert de beveiligde sessie-doorsturing ook te herstellen bij een onleesbare checkout-response en schrijft de uitkomst gericht naar de WooCommerce-log.

= 3.6.3 =
* Herstelt automatisch de Site B-doorsturing wanneer WooCommerce de order en betaallink succesvol heeft gemaakt, maar een thema of browserlaag de checkout-response afbreekt.
* De tijdelijke herstel-link blijft uitsluitend in de WooCommerce-sessie, is maximaal twee minuten geldig en wordt opnieuw gecontroleerd tegen de ingestelde Site B.

= 3.6.2 =
* Vangt serverfouten tijdens het voorbereiden van de Site A-overdracht gecontroleerd af. De checkout toont een gerichte melding in plaats van WooCommerce' algemene foutscherm.
* Schrijft de concrete oorzaak met het Site A-ordernummer naar WooCommerce → Status → Logs onder bron `cart-upsell-pro`.

= 3.5.1 =
* Checkout overslaan geeft expliciet aan dat de betaalprovider de klantgegevens verzamelt. Hiervoor is op Site B de nieuwe optie Betaling met los bedrag nodig.
* Ontvangt na betaling de klant- en verzendgegevens via een apart ondertekende callback van Site B. Controleert bedrag en valuta en overschrijft geen later bewerkte adressen bij een herhaalde callback.
* Meerdere herkomstsites worden op Site B ingesteld; elke Site A gebruikt dezelfde geheime sleutel. Thank-you-URL, fout-URL en taal worden per bestelling doorgegeven.
* De gateway-plugin op Site B moet het bedrag zonder productregel kunnen verwerken en de gegevens van de betaalprovider op de bijbehorende WooCommerce-bestelling opslaan. Er is geen gegevensformulier op Site A of B toegevoegd.

= 3.5.0 =
* Optionele instelling 'Checkout overslaan' (standaard uit) onder WooCommerce → Instellingen → Betalingen → Cart Upsell Pro.
* Bij inschakelen: checkoutlinks sturen automatisch door naar Site B met het actuele server-side winkelwagentotaal. De betaalmethode moet geactiveerd zijn.
* Maakt automatisch een onbetaalde bestelling met producten, kortingen, belastingen en reeds berekende verzendkosten. Er verschijnt geen klantgegevensformulier op Site A.
* Hergebruikt de onbetaalde bestelling bij opnieuw klikken zolang de winkelwagen en instellingen gelijk blijven.
* Betalingsbevestiging en order-pay/order-received blijven beschikbaar. Bij annuleren of een fout keert de klant terug naar de winkelwagen.
* In deze eerste versie moest Site B nog apart worden aangepast voor lege klantgegevens; zie versie 3.5.1 voor de nieuwe koppeling.
* Het doorgestuurde bedrag is het totaal dat Site A op dat moment kent. Verzendkosten/belastingen op basis van een later op Site B ingevuld adres worden niet automatisch op Site A herberekend. Adres- of e-mailafhankelijke checkoutvalidatie vindt bij deze optie niet op Site A plaats.
* Met de optie uit blijft de bestaande betaalmethodeflow behouden.

= 3.0.0 =
* Initial release.


== Lokale testversie 3.6.0 ==

Optionele korte betaallinks via een ondertekende serveraanvraag; tijdmetingen voor de overdracht. Werk eerst alle Site B-plugins bij naar 3.8.0. De bestaande overdracht blijft standaard geselecteerd.
Nog niet gevalideerd met een echte betaling op de doelhosting. Zie de meegeleverde installatiehandleiding.

// Beeldbibliotheek voor de winkel. De foto's komen van het publieke Coolblue
// beeldplatform en worden via het CDN geladen, zodat we geen zware bestanden in
// de repository bewaren.

const CONTENT_WIDTHS = [120, 240, 480, 600, 840, 960];
const PRODUCT_WIDTHS = [148, 200, 340, 500, 640];

export const contentPhoto = (hash: string, width = 480) =>
  `https://image.coolblue.nl/transparent/max/${width}xauto/content/${hash}`;

export const contentPhotoSet = (hash: string) =>
  CONTENT_WIDTHS.map((w) => `${contentPhoto(hash, w)} ${w}w`).join(', ');

export const productPhoto = (id: string, width = 500) =>
  `https://image.coolblue.nl/transparent/max/${width}xauto/products/${id}`;

export const productPhotoSet = (id: string) =>
  PRODUCT_WIDTHS.map((w) => `${productPhoto(id, w)} ${w}w`).join(', ');

export const editorialPhoto = (id: string, width = 668) =>
  `https://image.coolblue.nl/max/${width}xauto/content/${id}`;

/** Zelfde normalisatie als `collectionSlug`, zodat labels en slugs matchen. */
const key = (label: string) =>
  label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'en')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/** Onderwerpfoto's per genormaliseerd label. */
export const subjectPhotos: Record<string, string> = {
  // Categorieen zonder eigen sfeerfoto: hier staat een echte productfoto uit
  // dezelfde categorie, zodat elk artikel een passend beeld houdt.
  microfoons:'1383853',
  dashcams:'2107871',
  verrekijkers:'1409474',
  receivers:'1978592',
  'radio-s':'2205887',
  platenspelers:'2208695',
  papierversnipperaars:'1374474',
  audiostreamers:'2038149',
  telescopen:'1368433',
  'autoradio-s':'1589816',
  'hdmi-kabels':'1942794',
  'video-kabels':'2014228',
  studioverlichting:'aac5a971ac3427e46f1b1d392ea465f0',
  'accessoires-voor-printers':'b8c2074ea259214e873eae8e0e29ae33',
  'accu-grasmaaiers':'f304882a211706e96ed81d482cf914e0',
  'action-camera-s':'5da8912308571da28f271005793db123',
  'aeg':'64306bc384f28a067e580e4da7f823ee',
  'afkortzagen':'1cb96360e562b7b2df333dbdc9de42d1',
  'afzuigkappen':'23f308a7d7a69f45af9988c99d6ee287',
  'airco-s':'25cc924ad7b5d823471cb32217fa9da4',
  'airfryers':'3a3495d6a61f6fc16f6b7bca1f1657c3',
  'alles-voor-streaming':'a568ecdc189a8392269dca675f3f55ea',
  'apple':'78bca738bb1f161afbb34b76202c0e94',
  'apple-ipad':'b8b78dbd163c6c52a5c254913d390a37',
  'apple-oordopjes':'dfe113e44f3f03adba096a7c79190e84',
  'apple-watch':'a940448e482c1a94b86c0c1f9a13d8a0',
  'autoladers':'5bef9e82e0a852e15df5cbbcdb3ea4ee',
  'autonavigatie':'97b264c397e925a7b842dc20ed05629b',
  'barbecues':'b973f6472512a9b4a114056a6a240ed0',
  'bbq':'1d7c9bd71c8ccb318b0590bd8392ceaa',
  'beamers':'3b02a95f6c2c9721cd00eb5d9e290f8c',
  'besproeiingsbesturing':'253b0a9a010293847e5b7586f5622444',
  'bladblazers':'fefa4b34fd117342591161f7d6914e5e',
  'blenders':'ba4269db97c409d5784c25f5377c83fe',
  'bluetooth-speakers':'bfc3ea2b30ce01090c12d9c9224ccfb1',
  'bodygrooms':'b4e6527e06f2e59a5132e360632cfd91',
  'boorhamers':'5aa31764ebe0358e1b86e55ad511138c',
  'boormachines':'42dbe3614c0e67d2a51bb40f44394a33',
  'borstkolven':'fcc20bdc769bba0f9100f056097f380e',
  'bosch':'d5760edf0276db5738cc9225de59a0da',
  'bouwstofzuigers':'31afb8acb20e33bb3ea5bbd3316de7d8',
  'brandveiligheid':'477835559cac5c11ff9b4ea97438f560',
  'bureau-s':'c14f78261e17ce4593f56548a4885c75',
  'bureaustoelen':'6c38a95e16c313b54e65efbcabe68462',
  'camera-accessoires':'1fdbf3f1112ccc436085d006ee99022d',
  'camera-s':'8b1e275aee82fb74613a761bb0173cb7',
  'caravan-airco-s':'62e063f5d6edf089651be5396295b9db',
  'cirkelzagen':'13552a2569d82cadfb7daa0359f61ccd',
  'combihamers':'44e70b9e670791ffcdb2bed0e9731e22',
  'combisets':'f415b33e0f45895ba6ad3d236d2f5e39',
  'computer-onderdelen':'9981e4116ff67e8fac7a312786af1429',
  'conference-cams':'16c5c183a225e1b6d8ac55d11f0eed3a',
  'decoupeerzagen':'3795138e4aa0c10625016a95208b8294',
  'desktops':'7a37113104a5fd62e04416e634576354',
  'dj-controllers-en-muziek':'4a6f828181dd6bfb6b447bf576d84588',
  'draadloze-oordopjes':'3fad009626769321514b93c716b51a66',
  'draadloze-opladers':'23e80c611aae050805f1fc68b7c86bd3',
  'draadloze-speakers':'04e8a994150df101579e309f2ba645f5',
  'drogers':'4b3132d0b8db06588acf6636b4b71fb1',
  'drones':'ff8f5d45aa347270b2561b35429073b9',
  'duurzame-telefoons':'129a3eeeb362b4c63dd58ff359f2ceaf',
  'e-readers':'2c7b874351ab7b314434cf347c7b4f54',
  'elektrisch-gereedschap':'9277d4e2166017b3663bb0696db75211',
  'elektrische-barbecues':'417a159d4f01d0c77d99c24eb37d1433',
  'elektrische-dweilen':'bdab51d16b8723698e4c59b53fe421bb',
  'elektrische-grasmaaiers':'58659bbc0f83bb93e24de4f27d076ca5',
  'elektrische-kachels':'c6c0b363521cf1a25c7c1924e3b3d955',
  'energie-besparen':'74b20fa0f170f6f30e2c5b494cf7eb02',
  'energiezuinige-producten':'5851f4255add9c33d5f82306a0e53cd7',
  'epilatoren':'0488e949b6ed93a064e88959e8fa7323',
  'ergonomische-bureaustoelen':'488aa789e83aa384636ed613686a8da2',
  'flightsticks':'e64a11775863ad3237125d9cef750c34',
  'flosapparaten':'aa0f33d28d71fbb38db4f02c97551bbd',
  'fohns':'fb54643ed8bdab8f4dfa3698d41e1816',
  'fornuizen':'4fb15e76ef1df42b2ed5bdceb331f1f4',
  'foto-en-video':'fd60131a865579b928cabd31b0abb919',
  'fritz-box':'99beb07c8713c22ca9404cd39b523347',
  'fun-cooking':'079dbe7197c22590ab1e666e89f680f3',
  'garmin-smartwatches':'94a4058f988c343b990e3189456c9bd0',
  'gas-barbecues':'6ea88a9f37bd3452f26d2e77dd897f9e',
  'geheugenkaarten':'27b7fe03ad7d37804e7ea16b15d88335',
  'gezondheidshorloges':'d80b0c27ee68907d28f0fc48fb7b85a7',
  'grasmaaiers':'eea21d1f70aebcd6fcc3a140c2bf8c1f',
  'gratis-wassen-drogen-en-vaatwassen':'6034922e7b15cdedde921cbc00544a59',
  'groene-stroom-uit-nederland':'a24f096d26b3e1caeef0a81c82623130',
  'grote-keukenapparatuur':'ad005675f03f3356d10aef93c6ec3766',
  'haakse-slijpers':'d028e64dca0b5883fbd659a1f59d8d84',
  'hartslagmeters':'6b37a73e5906435db5f4bcc7f5932109',
  'health-trackers':'b1e13d6fea0451f9f43502abb9d08b42',
  'heggenscharen':'0d71dd5e67f2cca16e8670f95e74e55b',
  'hifi-speakers-en-subwoofers':'ce1ed95b8665dc2c3d42b7dd5b65ce62',
  'hogedrukreinigers':'ea77552f0c8676c376d76fc810ac53b8',
  'hoofdtelefoons':'01003822c684a313cd18e52c8a0d4910',
  'houtskool-barbecues':'da752d0032afdc3d60170b58b7c59923',
  'huawei-watch':'7325ff49ceb9810919dca5404a4f646c',
  'hybride-horloges':'1b579e4d8cd5dd4db885bbeb4167d398',
  'inbouw-apparatuur':'3b4b9845054c205a69d868491f972f80',
  'inbraakpreventie':'a71f08a552e7a0b982383dd62073e9d9',
  'kamado-barbecues':'6197dea8ee4bcb6391ca91e059be9ef1',
  'kleine-keukenapparatuur':'79c4912c5ba1806097b2d9beee5546a5',
  'klimaatbeheersing':'dc63ada4c771fe3d7b97cf2f3d140725',
  'klopboormachines':'af5e03ea6ff8e2db408fad45c49d77f2',
  'klussen':'15868eb9fb677e83d91638aa9e0a24d7',
  'koelkasten':'3f4c8ecd29bcf467bebd8ee4b914d4df',
  'koffie':'3b4503a28053e53bf270fa2fc620df9d',
  'koffiezetapparaten':'817e8500f8d9b6d559baf5da0e18a0c8',
  'koken-en-bakken':'38c5fed7334172c86867d3caaad09485',
  'kolomboormachines':'8d88997939719ba15f10deef669ac040',
  'kook-en-bakgerei':'2bb0b573e22375f3ac586af4aab95c79',
  'kookplaten':'25844f3851a5751015eda0055d7f7d1e',
  'koptelefoons':'828c5dd3b9f990465cc09e3cc77de5e3',
  'kruimeldieven':'7fe7b5fe73e50e1fbb0a4b50f5eb3b78',
  'krulborstels':'b12f03a25719d5c998fe2f62584dc1e4',
  'krultangen':'21d56d380d08a75a2ad997d49410c5ea',
  'ladyshaves':'e221bcdb204ac23c09d13f36728a1e78',
  'laptop-accessoires':'f663e1de493d9fe59014a26ed14809ad',
  'laptops':'940c7e31a7ad66547fff49e908185559',
  'laptops-desktops-en-monitoren':'e1c1f4deb21336eaadde839ecf330ede',
  'led-maskers':'861a12014364e9db6ad513cd3253fba8',
  'lenovo-tablets':'71614b2e8c4958eda4597587bb93c040',
  'lichtontharingsapparaten':'fd0dbdc5424fc064e1ee2b4e6ef28f41',
  'luchtbevochtigers':'571a5db55ff633ecf74d9d48174b0146',
  'luchtontvochtigers':'2501aed38907de8d3f387827dca92b7a',
  'luchtreinigers':'3dcee7b2495bc9c765b732c1f1622752',
  'magnetrons':'2f1fd06d9f98f451235eaf1c711815ea',
  'magsafe-powerbanks':'7dd80c7ef75c734e8d1b39ea505c6abf',
  'miele':'2aec9bcc78701c4c07b9e8d8871a98e3',
  'mini-beamers':'0299b1b1ac2933db9dde307cdf3d0d05',
  'mobiele-telefoons':'bab09681ffbcd4e6075e1cb9beca94e5',
  'monitoren':'2ec674c4042eac80efb165b9e454509b',
  'motornavigatie':'ef9751a65e1ab97017da038c2aab4ff2',
  'muizen':'ba02e2df09dc77a12369050fa3317d0e',
  'multigrooms':'156bc6b512a42ab31ad847a1e26a9d89',
  'multitools':'3766e22db6d5b315199d6d293cbb0220',
  'muziek':'bb9767dc3f03c6bff91f6829baf6746d',
  'nas':'c8fa73c709aa572c83258c089421935b',
  'navigatiesystemen':'e8ee23d38333d332dc805ff984ee4a87',
  'netgear':'14112aaee270c8bc0a23908a570d32d2',
  'netwerk':'391bbc76e90e858f0561bc0b519a06ca',
  'netwerk-en-internet':'4338b006daac612fc0ec15ae862869b7',
  'office-headsets':'02fad666998062292c8eaedf8d2f1af3',
  'onderweg':'8df6f88befb8bd593579e2c4a31b808b',
  'onkruidverwijderaars':'bc74e5bd2b07c67d91d8b30f4ad03ad4',
  'ontharen':'08567185bb7d0f0895a5fd7df97c5516',
  'oordopjes':'d98f7b77ad221d1c4cdf6b998e274450',
  'opbergen-en-bewaren':'a97d53d754cbc82a52dca1b4ef833179',
  'opvouwbare-telefoons':'f71c6e7d7a036a5c3c2dfc06c20ef6dd',
  'ovens':'a194a0612a67aebb10c013878162eeb5',
  'pannen-en-kokers':'020a3d0c2c4fc0400d70506dcd751d32',
  'party-speakers':'1fcc358aedbe4272abba5be1aed2e436',
  'pellet-barbecues':'77f701b5f1a3aae66c0c4fde454fa66f',
  'personenweegschalen':'1aad20ece803408829248fa7395ede24',
  'philips':'dd945be70d891b38281f0ffb691c25ae',
  'plancha-barbecues':'146921e6e0fa60e4e70fcbe8291e0fe6',
  'power-blenders':'f4d7f3a830e84439d471b56c9296d8ea',
  'powerbanks':'085165f0b2bf4db8eebb54f177341a0f',
  'powerbanks-voor-laptops':'b225cff2196adf15d380cfbb59490dcc',
  'printers':'bffccf573f1b7c1323290a341709fbf6',
  'processoren':'65d399ce1dbc5316c46a4d31627acbc9',
  'quooker':'531aa01abbaf4ad0c05e0f2772e87511',
  'reciprozagen':'20578f1b0c5a71e910c716e9af19d935',
  'robotmaaiers':'3877ebe1de26cb32ab53f4a47f9e3649',
  'robotstofzuigers':'ebfd95b776e6b4e27ff7911466aeb290',
  'routers':'d4d1bf98f53aed8ef997631c6a529ed1',
  'samsung':'b834188bafdd72a6ab78df35fa9b5564',
  'samsung-galaxy-watch':'bb2d689d31cbd25925e7729a907f0725',
  'samsung-tablets':'8fc9e8fb8901adddd8c22d32d90b1f1d',
  'scheren-en-trimmen':'5ede7c892e732f109e6c44c552bc4dd9',
  'schoonmaken':'e239c6a894ebc9f2567af09487462f9a',
  'schroefboormachines':'7aca751fced9366c0c1bb39120644e1e',
  'schroefmachines':'360746fc0c904390da86238116839c24',
  'schuurmachines':'210e71c539ca286eab005581301abe7f',
  'screenprotectors':'b90d6a80b725670843ea26be6f9f5c1a',
  'siemens':'bd069990e499c53c84de0ad982e453c7',
  'slagschroevendraaiers':'e2e34cd84d322f91f53fd77ec601ad37',
  'slimme-alarmsystemen':'531fd48d889967fa6decc4c197628a5a',
  'slimme-beveiligingscamera-s':'eaedabe12749d324686ddc0b281b6634',
  'slimme-deurbellen':'b21a08ea8bef7046c52be6f6715a89e5',
  'slimme-deursloten':'4f0f0bb0199f5649872458eaad2d1bbc',
  'slimme-horloges':'611ad5280c7f86c2c1439394e98c3b8c',
  'slimme-rookmelders':'5752481446955b13e17a621c9cc444c2',
  'slimme-stekkers':'6762292878e91bcefc528962d1192ad8',
  'slimme-thermostaten':'4200a02ed74187ae3c7b46ac921e159b',
  'slimme-verlichting':'dd017ea078535e5c30e91a667d7af0d6',
  'smart-home':'48416be93d9663af9672ab2b04ce6d7e',
  'smart-home-hubs':'0ae6f27755c3f818d7a111b1732cd70e',
  'smartphones':'714a0401990226bfadbba4efe6d15cd7',
  'smartwatches':'c22515d7993487f62782fd44a7eed0ee',
  'smoothie-makers':'20fc9d760b1ab728afa660b115ea6d45',
  'soundbars':'45bc9eca7eb6f6e95cc911bfb5845a95',
  'starlink':'edc4169f2164f71a798627aae6848001',
  'steelstofzuigers':'a3a9eabc8e913c29371e2a592922c9c2',
  'stijltangen':'f5fbc95590ae07c80abccde8d2e2ef9b',
  'stofzuigen':'9fb5a66b1aacd01ce2187f44095c3910',
  'stofzuigers':'a86a1a68e44babfec145fdd290e4ec47',
  'streaming':'a568ecdc189a8392269dca675f3f55ea',
  'streaming-webcams':'3d0cb20d3ad224037ac7ab78e1eac4d1',
  'strijken':'0a034611d1d647484a7e06eb74a463f7',
  'strijkijzers':'d020a610a75539cb8e52ba84b0b63002',
  'tablet-accessoires':'51323471edb46c3e14d9081400a4e4e8',
  'tablet-hoezen':'433a82cf622ed4864a5504860bfda01c',
  'tablets':'a2b2022e81e359f49e83d5508fc05b49',
  'tablets-en-e-readers':'6421c518f2077c2a32df583c1583d910',
  'telecom':'67db162eb0deaf252e2ef96109bf183d',
  'telefoon-opladers':'241794eb41906036ee6394487a36ec99',
  'telefoonhoesjes':'4757fbc3d18f40e6446bd3bf64d1283c',
  'televisiebeugels':'5d9e39c0c5cee800c00cdae45c5ce6c1',
  'televisies':'c5ceebf7c50a83e439fa8d815ffe0fb5',
  'televisies-met-soundbars':'497e68d1cf4d8939434335e76335c941',
  'terrasverwarmers':'e438b0d3491f3ebd560a948aa51066e6',
  'thuisbioscoop-beamers':'d89988c225571b464589d7279254f865',
  'thuiswerk-webcams':'c3014279db1747910544f7d7d05d3f70',
  'toetsenbord-en-muis-sets':'4d0386ed9e372802ae9c82f002b1d8bc',
  'tondeuses':'07577bff4dc8c9013897c524c4ed5f1a',
  'tp-link':'95127aa75e4a8ea5ef9134e9bbd12d38',
  'traditionele-stofzuigers':'e2058e8202fb9309887b46505a92c948',
  'tuin':'02b17eda5ece73de3c31622df6b4d5df',
  'tuinbewatering':'67df0e5f902d8452f90857e4220e7ada',
  'tuingereedschap':'ed3899749d97c6ed657b6def1a458f4b',
  'tuinslangen':'c15f5586dd8f1dd19a2d00c91778f267',
  'vaatwassers':'737bf0f297d76e8cb196e1e2aa9d01f5',
  'vaste-telefoons':'c5346e538ef9d2a98d6e8ae6196c85f3',
  'ventilatoren':'2ea2fdb187e835f1f7e023b9e0499897',
  'verticuteermachines':'1f0d22527228de10c393513ad678d69d',
  'videokaarten':'2887bf9e0affc663b76fdc23e5000cbf',
  'vriezers':'a9b8df43294499719457541c66426ec5',
  'wafeltangen':'8cfd4a865f969ecd99f7b5a4d5044e49',
  'was-droogcombinaties':'944dad95264eecc65b9b007e418eb2b8',
  'wasdrogers':'08ffdf0fa35e58c365cd8894aa38c13e',
  'wasmachine-en-droger-sets':'fd2f789431ce9629b54750dafe22d53c',
  'wasmachines':'8c2565aaba9ab00f270b3665d34413b8',
  'wassen-en-drogen':'fefb67b6d910251b8b5d5f03d8f19432',
  'waterpompen':'e041dcb91f311a3aadb87b01b0d82168',
  'webcams':'2f9d2b587f7a0368930e27390749beb9',
  'weerstations':'5cf3d72671d2e742999cb6e3f4b0007c',
  'wifi-speakers':'66ad1c394eb9ab56d39f7e3844fb898b',
  'wijnklimaatkasten':'ce9a1858dfc939a87f1913a1bd798317',
  'woonaccessoires':'3f65425ad6c9e529aef7b6eb969a1302',
  'zaagmachines':'cf7e032d9ae5ee0f1745104080f012ed',
  'zakelijke-beamers':'231a2441cdb1742cef3a6db636ca98b0',
  'zakelijke-cadeaus':'73ce4ecc3066f60f3c9077ea61b5ecb9',
};

/** Handmatige koppeling van onze collectie- en itemnamen aan een onderwerpfoto. */
export const subjectAliases: Record<string, string> = {
  zzp:'laptops',
  kleinzakelijk:'laptops',
  mkb:'desktops',
  grootzakelijk:'monitoren',
  'gratis-wassen-en-drogen':'gratis-wassen-drogen-en-vaatwassen',
  // Computers & tablets
  'geheugen-en-opslag':'geheugenkaarten',
  'printers-inkt-en-scanners':'printers',
  'windows-laptops':'laptops',
  'apple-macbook':'apple',
  'zakelijke-laptops':'laptops',
  'laptop-workstations':'desktops',
  chromebooks:'laptops',
  'zakelijke-monitoren':'monitoren',
  'zakelijke-desktops':'desktops',
  laptophoezen:'laptop-accessoires',
  toetsenborden:'toetsenbord-en-muis-sets',
  'zakelijke-tablets':'tablets',
  tablethoezen:'tablet-hoezen',
  'digitale-notitieblokken':'e-readers',
  // Telefonie
  'telefoon-accessoires':'telefoonhoesjes',
  'iphone-accessoires':'apple',
  'samsung-accessoires':'samsung',
  // Beeld & geluid
  'televisies-en-beamers':'televisies',
  'televisie-accessoires':'televisiebeugels',
  'home-cinema':'soundbars',
  'speakers-en-boxen':'bluetooth-speakers',
  'audio-voor-onderweg':'draadloze-oordopjes',
  // Keuken
  keukenmachines:'blenders',
  pannen:'pannen-en-kokers',
  // Huishouden & wonen
  'was-en-droog':'wassen-en-drogen',
  klimaat:'klimaatbeheersing',
  wonen:'woonaccessoires',
  // Foto & video
  'video-en-actioncamera-s':'action-camera-s',
  'fotocamera-s':'camera-s',
  'content-creatie':'streaming',
  'kijkers-en-scopes':'camera-s',
  // Klussen & tuin
  gereedschap:'elektrisch-gereedschap',
  'buiten-koken':'bbq',
  werkplaats:'zaagmachines',
  // Onderweg
  navigatie:'navigatiesystemen',
  auto:'autonavigatie',
  reizen:'koelboxen',
  // Coolblue Energie
  opladen:'powerbanks',
  'duurzaam-onderweg':'autoladers',
  installatie:'slimme-thermostaten',
  // Zakelijk & thuiswerken
  'thuis-werkplek':'bureau-s',
  'zakelijke-services':'office-headsets',
  bedrijfswinkel:'zakelijke-cadeaus',
  // Computers & tablets
  'mesh-wifi-routers':'routers',
  'access-points':'netwerk',
  'powerline-adapters':'netwerk',
  switches:'netwerk',
  'wifi-versterkers':'routers',
  moederborden:'computer-onderdelen',
  'ram-geheugen':'computer-onderdelen',
  computervoedingen:'computer-onderdelen',
  computerbehuizingen:'computer-onderdelen',
  'interne-harde-schijven':'geheugenkaarten',
  'interne-ssd':'geheugenkaarten',
  'externe-harde-schijven':'geheugenkaarten',
  'externe-ssd':'geheugenkaarten',
  'zakelijke-printers':'printers',
  'all-in-one-printers':'printers',
  scanners:'printers',
  'printer-inkt':'accessoires-voor-printers',
  // Telefonie
  'apple-iphone':'smartphones',
  'refurbished-iphone':'smartphones',
  'samsung-smartphones':'smartphones',
  'opvouwbare-smartphones':'opvouwbare-telefoons',
  'zakelijke-telefoons':'smartphones',
  'refurbished-telefoons-en-tablets':'smartphones',
  'iphone-hoesjes':'telefoonhoesjes',
  'iphone-screenprotectors':'screenprotectors',
  'iphone-opladers':'telefoon-opladers',
  'samsung-hoesjes':'telefoonhoesjes',
  'samsung-screenprotectors':'screenprotectors',
  'samsung-telefoon-opladers':'telefoon-opladers',
  'dect-telefoons':'vaste-telefoons',
  'gigaset-telefoons':'vaste-telefoons',
  'vaste-seniorentelefoons':'vaste-telefoons',
  'samsung-galaxy-smartwatches':'samsung-galaxy-watch',
  // Beeld & geluid
  'smart-tv-s':'televisies',
  'oled-tv-s':'televisies',
  'qled-tv-s':'televisies',
  'tv-met-soundbar':'televisies-met-soundbars',
  'tv-beugels':'televisiebeugels',
  'tv-standaards':'televisiebeugels',
  mediaspelers:'streaming',
  'home-cinema-sets':'soundbars',
  subwoofers:'hifi-speakers-en-subwoofers',
  'sonos-speakers':'wifi-speakers',
  'hifi-speakers':'hifi-speakers-en-subwoofers',
  'noise-cancelling-koptelefoons':'koptelefoons',
  'apple-airpods':'apple-oordopjes',
  'dj-gear':'dj-controllers-en-muziek',
  'studio-gear':'dj-controllers-en-muziek',
  keyboards:'muziek',
  // Zakelijk & thuiswerken
  bureaus:'bureau-s',
  laptopstandaarden:'laptop-accessoires',
  'docking-stations':'laptop-accessoires',
  'vergader-microfoons':'conference-cams',
  thuiswerkwinkel:'bureau-s',
  'bring-your-own-device':'laptops',
  cadeauwinkel:'zakelijke-cadeaus',
  kerstgeschenken:'zakelijke-cadeaus',
  // Huishouden & wonen
  'wasmachine-abonnementen':'wasmachines',
  'witgoed-abonnementen':'wassen-en-drogen',
  'witgoed-reparaties':'wassen-en-drogen',
  'gratis-wassen-drogen':'gratis-wassen-drogen-en-vaatwassen',
  stoomstrijkijzers:'strijkijzers',
  stoomgeneratoren:'strijkijzers',
  kledingstomers:'strijken',
  'alle-stofzuigers':'stofzuigers',
  'dyson-stofzuigers':'steelstofzuigers',
  stoomreinigers:'schoonmaken',
  ruitenreinigers:'schoonmaken',
  prullenbakken:'opbergen-en-bewaren',
  thermostaten:'slimme-thermostaten',
  'ip-camera-s':'slimme-beveiligingscamera-s',
  alarmsystemen:'slimme-alarmsystemen',
  'smart-lampen':'slimme-verlichting',
  'philips-hue':'slimme-verlichting',
  'smart-lamp-startpakketten':'slimme-verlichting',
  'slimme-buitenverlichting':'slimme-verlichting',
  'tuin-en-klussen':'tuin',
  // Keuken
  'inbouw-keukenapparatuur':'inbouw-apparatuur',
  frituurpannen:'kleine-keukenapparatuur',
  waterkokers:'kleine-keukenapparatuur',
  'contactgrills-en-tosti-ijzers':'wafeltangen',
  broodbakmachines:'kleine-keukenapparatuur',
  ijsmachines:'kleine-keukenapparatuur',
  bruiswatermachines:'kleine-keukenapparatuur',
  'volautomatische-espressomachines':'koffiezetapparaten',
  'jura-koffiemachines':'koffiezetapparaten',
  pistonmachines:'koffiezetapparaten',
  nespresso:'koffie',
  senseo:'koffie',
  'dolce-gusto':'koffie',
  filterkoffieapparaten:'koffiezetapparaten',
  melkopschuimers:'koffie',
  keukenmixers:'blenders',
  foodprocessors:'blenders',
  staafmixers:'blenders',
  handmixers:'blenders',
  hakmolens:'blenders',
  juicers:'smoothie-makers',
  pannensets:'pannen-en-kokers',
  koekenpannen:'pannen-en-kokers',
  braadpannen:'pannen-en-kokers',
  gourmetstellen:'fun-cooking',
  pizzaovens:'fun-cooking',
  grillplaten:'plancha-barbecues',
  'weber-barbecues':'gas-barbecues',
  // Foto & video
  'drone-accessoires':'drones',
  '360-graden-camera-s':'action-camera-s',
  camcorders:'camera-s',
  'videocamera-accessoires':'camera-accessoires',
  'compactcamera-s':'camera-s',
  'systeemcamera-s':'camera-s',
  'spiegelreflexcamera-s':'camera-s',
  'instant-camera-s':'camera-s',
  cameralenzen:'camera-accessoires',
  lensfilters:'camera-accessoires',
  flitsers:'camera-accessoires',
  statieven:'camera-accessoires',
  cameratassen:'camera-accessoires',
  'accu-s-voor-camera-s':'camera-accessoires',
  fotolijstjes:'woonaccessoires',
  'vlog-camera-s':'action-camera-s',
  gimbals:'camera-accessoires',
  'foto-en-video-bewerkingssoftware':'foto-en-video',
  // Coolblue Energie
  energiecontracten:'groene-stroom-uit-nederland',
  'aanbod-energiecontracten':'groene-stroom-uit-nederland',
  'coolblue-energiedeals':'energie-besparen',
  'dynamische-uurprijzen':'energie-besparen',
  'overstappen-naar-coolblue-energie':'groene-stroom-uit-nederland',
  warmtepompen:'energiezuinige-producten',
  'warmtepomp-offerte-aanvragen':'energiezuinige-producten',
  'warmtepompen-advies':'energiezuinige-producten',
  zonnepanelen:'energiezuinige-producten',
  'zonnepanelen-advies-op-maat':'energiezuinige-producten',
  'zonnepanelen-advies':'energiezuinige-producten',
  laadpalen:'autoladers',
  'laadpalen-offerte-aanvragen':'autoladers',
  'laadpalen-advies':'autoladers',
  'laadpalen-assortiment':'autoladers',
  'split-airco-s':'airco-s',
  'split-airco-advies':'airco-s',
  'split-airco-assortiment':'airco-s',
  // Acties & merken
  'acties-en-merken':'zakelijke-cadeaus',
  aanbiedingen:'energiezuinige-producten',
  'alle-merken':'zakelijke-cadeaus',
  'televisie-aanbiedingen':'televisies',
  'smartphone-aanbiedingen':'smartphones',
  'laptops-aanbiedingen':'laptops',
  'desktop-aanbiedingen':'desktops',
  'tablet-aanbiedingen':'tablets',
  'wasmachine-aanbiedingen':'wasmachines',
  'wasdroger-aanbiedingen':'wasdrogers',
  'stofzuiger-aanbiedingen':'stofzuigers',
  'monitor-aanbiedingen':'monitoren',
  cadeaus:'zakelijke-cadeaus',
  cadeaubonnen:'zakelijke-cadeaus',
  'coolblue-fanartikelen':'zakelijke-cadeaus',
};

/** Afdelingsfoto's, overgenomen van de afdelingstegels op de homepage. */
export const categoryPhotos: Record<string, string> = {
  'computers-tablets':'60c48e49bf55d04ecc54ceced591e579',
  telefonie:'56d2dc533a104768a4bf226a367a7625',
  'beeld-geluid':'d68d63c4373f7012dab109881cd25125',
  keuken:'fcd08187538032c2b5c1a4e3d4fcf694',
  'huishouden-wonen':'768edae5de5046a4b5d79f31cf78c6e2',
  'foto-video':'e3e2c2ed3e905cbb12e62d40ad9596b2',
  'klussen-tuin':'31166d9ea92e940ca31f14f2964daf08',
  energie:'5d8b1bac65d5a0b45e033c40a0dfda10',
  'zakelijk-thuiswerken':'6c38a95e16c313b54e65efbcabe68462',
};

/** Productfoto's per productslug. */
export const productPhotos: Record<string, string> = {
  'hp-chromebook-x360-14b':'1455236854',
  'hp-chromebook-14a':'1777753774',
  'nikon-z6-iii-body':'2067389',
  'logitech-mx-master-4':'2218928',
  'samsung-galaxy-s26-256gb':'899873874',
  'samsung-galaxy-a56-128gb':'2144340',
  'samsung-galaxy-s25-256gb':'2134076',
  'samsung-galaxy-a36-128gb':'2144290',
  'samsung-galaxy-a17-128gb':'2210421',
  'samsung-galaxy-s25-fe-128gb':'2210877',
  'google-pixel-10':'2217065',
  'google-pixel-10-pro-256gb':'2217075',
  'google-pixel-9a-128gb':'2172027',
  'google-pixel-9-pro-256gb':'2116915',
  'logitech-mx-keys-s':'2139926',
  'krups-dolce-gusto-genio-s-plus':'1460362',
  'garmin-dash-cam-mini-3':'2107871',
  'garmin-dashcam-x310':'2107895',
  'nikon-monarch-m7-8x42':'1938941',
  'denon-avr-x2800h-receiver':'1824819',
  'sennheiser-momentum-4':'1796933',
  'jbl-charge-6':'2147995',
  'sonos-roam-2-speaker':'2053666',
  'jbl-flip-7-speaker':'2148093',
  'sonos-move-2':'1965057',
  'rode-podmic-usb':'2045312',
  'marantz-cinema-70s-slim':'1865800',
  'wiim-amp-pro':'2136992',
  'bluebuilt-hdmi-2-1-kabel-2m':'1942794',
  'dyson-v16-piston-animal':'2215588',
  'samsung-galaxy-s26-ultra-512gb':'1247189946',
  'apple-airpods-pro-3':'2213106',
  'sony-wf-1000xm6-oordopjes':'1796040313',
  'samsung-galaxy-buds4-pro':'176985400',
  'lenovo-thinkbook-16-g7':'2238121',
  'apple-iphone-16-pro-256':'2093114',
  // iPhone 18: Coolblue heeft per kleur één productfoto, ongeacht de opslagcapaciteit.
  'apple-iphone-18-pro-256gb-lichtblauw':'635403575',
  'apple-iphone-18-pro-512gb-zwart':'959260287',
  'apple-iphone-18-pro-512gb-lichtblauw':'635403575',
  'apple-iphone-18-pro-512gb-zilver':'1906958841',
  'apple-iphone-18-pro-1tb-zwart':'959260287',
  'apple-iphone-18-pro-1tb-bordeaux-rood':'1395171669',
  'apple-iphone-18-pro-1tb-zilver':'1906958841',
  'apple-iphone-18-pro-1tb-lichtblauw':'635403575',
  'apple-iphone-18-pro-2tb-bordeaux-rood':'1395171669',
  'apple-iphone-18-pro-2tb-zilver':'1906958841',
  'apple-iphone-18-pro-256gb-bordeaux-rood':'1395171669',
  'apple-iphone-18-pro-2tb-lichtblauw':'635403575',
  'apple-iphone-18-pro-2tb-zwart':'959260287',
  'apple-iphone-18-pro-256gb-zwart':'959260287',
  'apple-iphone-18-pro-512gb-bordeaux-rood':'1395171669',
  'apple-iphone-18-pro-256gb-zilver':'1906958841',
  'apple-iphone-18-pro-max-2tb-zwart':'2040824451',
  'apple-iphone-18-pro-max-2tb-lichtblauw':'1366838204',
  'apple-iphone-18-pro-max-2tb-zilver':'452936974',
  'apple-iphone-18-pro-max-256gb-bordeaux-rood':'1807128594',
  'apple-iphone-18-pro-max-256gb-zwart':'2040824451',
  'apple-iphone-18-pro-max-256gb-lichtblauw':'1366838204',
  'apple-iphone-18-pro-max-512gb-bordeaux-rood':'1807128594',
  'apple-iphone-18-pro-max-512gb-zwart':'2040824451',
  'apple-iphone-18-pro-max-256gb-zilver':'452936974',
  'apple-iphone-18-pro-max-512gb-lichtblauw':'1366838204',
  'apple-iphone-18-pro-max-512gb-zilver':'452936974',
  'apple-iphone-18-pro-max-1tb-bordeaux-rood':'1807128594',
  'apple-iphone-18-pro-max-2tb-bordeaux-rood':'1807128594',
  'apple-iphone-18-pro-max-1tb-zwart':'2040824451',
  'apple-iphone-18-pro-max-1tb-zilver':'452936974',
  'apple-iphone-18-pro-max-1tb-lichtblauw':'1366838204',
  'samsung-qled-boardroom-65':'2168409',
  'logitech-mx-keys-combo':'2139687',
  'jura-e8-office':'2223909',
  'canon-eos-r8-creator-kit':'1881145',
  'dell-ultrasharp-u2724d':'1725345',
  'sony-wh1000xm6':'2175273',
  'dyson-v15-detect':'1985353',
};

/**
 * Voor producten zonder eigen productfoto vallen we terug op een onderwerpfoto.
 * Coolblue verkoopt laadpalen als dienst en heeft er dus geen productfoto van.
 */
export const productSubjectFallbacks: Record<string, string> = {
  'easee-charge-up':'autoladers',
  // Tweedekans-artikelen krijgen het beeld van hun eigen productsoort.
  'tweedekans-bosch-wasmachine-9kg':'wasmachines',
  'tweedekans-dyson-v12-detect-slim':'steelstofzuigers',
  'tweedekans-lg-oled-c5-55':'televisies',
  'tweedekans-hp-elitebook-840-g10':'laptops',
  'tweedekans-macbook-air-13-m4':'laptops',
  'tweedekans-dyson-v15-detect':'steelstofzuigers',
  'tweedekans-sonos-arc-ultra':'soundbars',
  'tweedekans-samsung-galaxy-s25-ultra':'smartphones',
  'tweedekans-de-longhi-volautomaat':'koffiezetapparaten',
  'tweedekans-philips-airfryer-xxl':'airfryers',
  'tweedekans-lenovo-thinkpad-t14':'laptops',
  'tweedekans-dji-mini-4-pro':'drones',
  'tweedekans-miele-vaatwasser-g5310':'vaatwassers',
  'tweedekans-sony-a7-iv-body':'camera-s',
  'tweedekans-apple-ipad-air-11-m3':'tablets',
  'tweedekans-weber-genesis-gasbarbecue':'gas-barbecues',
  'tweedekans-roborock-s8-maxv-ultra':'robotstofzuigers',
  'tweedekans-samsung-odyssey-oled-g8':'monitoren',
  'tweedekans-bose-quietcomfort-ultra':'koptelefoons',
  'tweedekans-siemens-inbouwoven':'ovens',
};

/** Merkfoto's voor de merkenwereld. */
export const brandPhotos: Record<string, string> = {
  apple:'apple',
  samsung:'samsung',
  lenovo:'lenovo-tablets',
  philips:'philips',
  bosch:'bosch',
  siemens:'siemens',
  miele:'miele',
  aeg:'aeg',
  logitech:'toetsenbord-en-muis-sets',
  sony:'hoofdtelefoons',
  canon:'camera-s',
  dyson:'steelstofzuigers',
  dell:'monitoren',
  jura:'koffiezetapparaten',
  easee:'autoladers',
  hp:'printers',
  karcher:'hogedrukreinigers',
  kitchenaid:'blenders',
  sonos:'wifi-speakers',
  bluebuilt:'laptop-accessoires',
  wisberg:'koelkasten',
};

/** Redactionele foto's met mensen, voor servicevlakken en banners. */
export const editorialPhotos = {
  bezorging:'413901094',
  winkel:'574083',
  specialist:'555142',
};

/** Zoekt een onderwerpfoto op basis van een vrij label. */
export const subjectPhotoFor = (label: string): string | undefined => {
  const slug = key(label);
  const alias = subjectAliases[slug];
  return subjectPhotos[slug] ?? (alias ? subjectPhotos[alias] : undefined);
};

/**
 * Kiest de beste foto voor een collectie: eerst de collectie zelf, dan een van
 * de onderliggende items en als laatste de afdelingsfoto.
 */
export const collectionPhotoFor = (
  collection: string,
  items: readonly string[] = [],
  categorySlug?: string,
): string | undefined => {
  const direct = subjectPhotoFor(collection);
  if (direct) return direct;
  for (const item of items) {
    const found = subjectPhotoFor(item);
    if (found) return found;
  }
  return categorySlug ? categoryPhotos[categorySlug] : undefined;
};

/** Afdelingsfoto met terugval op een onderwerpfoto met dezelfde naam. */
export const categoryPhotoFor = (slug: string, name?: string) =>
  categoryPhotos[slug] ?? (name ? subjectPhotoFor(name) : undefined);

export type Photo = { src: string; srcSet: string };

export const contentImage = (hash: string, width = 480): Photo => ({
  src: contentPhoto(hash, width),
  srcSet: contentPhotoSet(hash),
});

export const productImage = (id: string, width = 500): Photo => ({
  src: productPhoto(id, width),
  srcSet: productPhotoSet(id),
});

/**
 * Een verwijzing is of een contenthash van 32 tekens, of het nummer van een
 * product. Zo kan een subcollectie ook een echte productfoto gebruiken.
 */
const isProductRef = (ref: string) => /^\d+$/.test(ref);

/** Zet een verwijzing om in een beeld, ongeacht het soort verwijzing. */
export const refImage = (ref: string, width = 480): Photo =>
  isProductRef(ref) ? productImage(ref, width) : contentImage(ref, width);

/** Onderwerpfoto als compleet beeld, klaar voor een `<img>`. */
export const subjectImage = (label: string, width = 480): Photo | undefined => {
  const ref = subjectPhotoFor(label);
  return ref ? refImage(ref, width) : undefined;
};

export const categoryImageFor = (slug: string, name?: string, width = 480): Photo | undefined => {
  const ref = categoryPhotoFor(slug, name);
  return ref ? refImage(ref, width) : undefined;
};

/** Beste beeld voor een collectie, inclusief terugval op de afdelingsfoto. */
export const collectionImageFor = (
  collection: string,
  items: readonly string[] = [],
  categorySlug?: string,
  width = 480,
): Photo | undefined => {
  const ref = collectionPhotoFor(collection, items, categorySlug);
  return ref ? refImage(ref, width) : undefined;
};

/** Productfoto met terugval op een onderwerpfoto. */
export const productImageFor = (slug: string, width = 500): Photo | undefined => {
  const id = productPhotos[slug];
  if (id) return productImage(id, width);
  const fallback = productSubjectFallbacks[slug];
  const ref = fallback ? subjectPhotos[fallback] : undefined;
  return ref ? refImage(ref, Math.min(width, 960)) : undefined;
};

/**
 * Beeld bij een product: de eigen productfoto als die bestaat, anders de
 * onderwerpfoto van de subcollectie zodat ook nieuwe artikelen een foto houden.
 */
export const productOrSubjectImage = (
  slug: string,
  subject: string,
  width = 500,
): Photo | undefined => productImageFor(slug, width) ?? subjectImage(subject, Math.min(width, 960));

export const brandPhotoFor = (brand: string) => {
  const subject = brandPhotos[key(brand)];
  return subject ? subjectPhotos[subject] : undefined;
};

export const brandImageFor = (brand: string, width = 480): Photo | undefined => {
  const ref = brandPhotoFor(brand);
  return ref ? refImage(ref, width) : undefined;
};

/** Foto bij een product: een meegegeven beeldnummer (zoals bij overgenomen producten) gaat voor. */
export const photoForProduct = (
  product: { slug: string; subcategory: string; imageId?: string },
  width = 500,
): Photo | undefined => (product.imageId ? productImage(product.imageId, width) : productOrSubjectImage(product.slug, product.subcategory, width));

/** Alle foto's bij een product, hoofdfoto eerst. Producten met één foto krijgen een lijst van één. */
export const photosForProduct = (
  product: { slug: string; subcategory: string; imageId?: string; imageIds?: string[] },
  width = 900,
): Photo[] => {
  if (product.imageIds?.length) return product.imageIds.map((id) => productImage(id, width));
  const photo = photoForProduct(product, width);
  return photo ? [photo] : [];
};

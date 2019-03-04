(function() {
    var mnemonic = new Mnemonic("english");
    var el_phrase = $('#phrase');
    var el_btc_pubkey = $('#btc-pub-key');
    var el_ltc_pubkey = $('#ltc-pub-key');
    var el_bch_pubkey = $('#bch-pub-key');
    var el_dash_pubkey = $('#dash-pub-key');

    var el_generated_data = $('#generated-data');
    var el_info_text = $('#info-text');


    var btc_priv_key;
    var ltc_priv_key;
    var dash_priv_key;
    var bch_priv_key;

    var btc_pub_key;
    var ltc_pub_key;
    var dash_pub_key;
    var bch_pub_key;
    

    function calcBip32RootKeyFromSeed(phrase, passphrase) {
        seed = mnemonic.toSeed(phrase, passphrase);

        bip32RootKey_BCH = bitcoinjs.bitcoin.HDNode.fromSeedHex(seed, bitcoinjs.bitcoin.networks.bitcoin);
        bip32RootKey_BTC = bitcoinjs.bitcoin.HDNode.fromSeedHex(seed, bitcoinjs.bitcoin.networks.bitcoin.p2wpkhInP2sh);
        bip32RootKey_LTC = bitcoinjs.bitcoin.HDNode.fromSeedHex(seed, bitcoinjs.bitcoin.networks.litecoin.p2wpkhInP2sh);
        bip32RootKey_DASH =bitcoinjs.bitcoin.HDNode.fromSeedHex(seed, bitcoinjs.bitcoin.networks.dash);

        var accountExtendedKey_BTC = cp_calcBip32ExtendedKey("m/49'/0'/0'/", bip32RootKey_BTC);
        var accountExtendedKey_LTC = cp_calcBip32ExtendedKey("m/49'/2'/0'/", bip32RootKey_BTC); // Electrum-LTC is using btc public key serialization format
        var accountExtendedKey_DASH = cp_calcBip32ExtendedKey("m/44'/5'/0'/", bip32RootKey_DASH);
        var accountExtendedKey_BCH = cp_calcBip32ExtendedKey("m/44'/145'/0'/", bip32RootKey_BCH);

        btc_pub_key = accountExtendedKey_BTC.neutered().toBase58();
        btc_priv_key = accountExtendedKey_BTC.toBase58();

        ltc_pub_key = accountExtendedKey_LTC.neutered().toBase58();
        ltc_priv_key = accountExtendedKey_LTC.toBase58();

        bch_pub_key = accountExtendedKey_BCH.neutered().toBase58();
        bch_priv_key = accountExtendedKey_BCH.toBase58();

        dash_pub_key = accountExtendedKey_DASH.neutered().toBase58();
        dash_priv_key = accountExtendedKey_DASH.toBase58();
        
        el_btc_pubkey.val(accountExtendedKey_BTC.neutered().toBase58());
        el_ltc_pubkey.val(accountExtendedKey_LTC.neutered().toBase58());
        el_bch_pubkey.val(accountExtendedKey_BCH.neutered().toBase58());
        el_dash_pubkey.val(accountExtendedKey_DASH.neutered().toBase58());

        el_generated_data.show();
        el_info_text.hide();

    }


    function cp_calcBip32ExtendedKey(path, bip32RootKey) {
        // Check there's a root key to derive from
        if (!bip32RootKey) {
            return bip32RootKey;
        }
        var extendedKey = bip32RootKey;
        // Derive the key from the path
        var pathBits = path.split("/");
        for (var i=0; i<pathBits.length; i++) {
            var bit = pathBits[i];
            var index = parseInt(bit);
            if (isNaN(index)) {
                continue;
            }
            var hardened = bit[bit.length-1] == "'";
            var isPriv = !(extendedKey.isNeutered());
            var invalidDerivationPath = hardened && !isPriv;
            if (invalidDerivationPath) {
                extendedKey = null;
            }
            else if (hardened) {
                extendedKey = extendedKey.deriveHardened(index);
            }
            else {
                extendedKey = extendedKey.derive(index);
            }
        }
        return extendedKey
    }

    function hasStrongRandom() {
        return 'crypto' in window && window['crypto'] !== null;
    }

    function uint8ArrayToHex(a) {
        var s = ""
        for (var i=0; i<a.length; i++) {
            var h = a[i].toString(16);
            while (h.length < 2) {
                h = "0" + h;
            }
            s = s + h;
        }
        return s;
    }

    function showValidationError(error) {
        alert(error);
    }

    function generateRandomPhrase() {
        if (!hasStrongRandom()) {
            var errorText = "This browser does not support strong randomness";
            showValidationError(errorText);
            return;
        }
        // get the amount of entropy to use
        var numWords = parseInt(12);
        var strength = numWords / 3 * 32;
        var buffer = new Uint8Array(strength / 8);
        // create secure entropy
        var data = crypto.getRandomValues(buffer);
        // show the words
        var words = mnemonic.toMnemonic(data);
        // show the entropy
        var entropyHex = uint8ArrayToHex(data);

        return words;
    }

    // TODO look at jsbip39 - mnemonic.splitWords
    function phraseToWordArray(phrase) {
        var words = phrase.split(/\s/g);
        var noBlanks = [];
        for (var i=0; i<words.length; i++) {
            var word = words[i];
            if (word.length > 0) {
                noBlanks.push(word);
            }
        }
        return noBlanks;
    }

    // TODO look at jsbip39 - mnemonic.joinWords
    function wordArrayToPhrase(words) {
        var phrase = words.join(" ");
        var language = getLanguageFromPhrase(phrase);
        if (language == "japanese") {
            phrase = words.join("\u3000");
        }
        return phrase;
    }

    function getLanguageFromPhrase(phrase) {
        // Check if how many words from existing phrase match a language.
        var language = "";
        if (!phrase) {
            phrase = el_phrase.val();
        }
        if (phrase.length > 0) {
            var words = phraseToWordArray(phrase);
            var languageMatches = {};
            for (l in WORDLISTS) {
                // Track how many words match in this language
                languageMatches[l] = 0;
                for (var i=0; i<words.length; i++) {
                    var wordInLanguage = WORDLISTS[l].indexOf(words[i]) > -1;
                    if (wordInLanguage) {
                        languageMatches[l]++;
                    }
                }
                // Find languages with most word matches.
                // This is made difficult due to commonalities between Chinese
                // simplified vs traditional.
                var mostMatches = 0;
                var mostMatchedLanguages = [];
                for (var l in languageMatches) {
                    var numMatches = languageMatches[l];
                    if (numMatches > mostMatches) {
                        mostMatches = numMatches;
                        mostMatchedLanguages = [l];
                    }
                    else if (numMatches == mostMatches) {
                        mostMatchedLanguages.push(l);
                    }
                }
            }
            if (mostMatchedLanguages.length > 0) {
                // Use first language and warn if multiple detected
                language = mostMatchedLanguages[0];
                if (mostMatchedLanguages.length > 1) {
                    console.warn("Multiple possible languages");
                    console.warn(mostMatchedLanguages);
                }
            }
        }
        return language;
    }

    function getLanguageFromUrl() {
        for (var language in WORDLISTS) {
            if (window.location.hash.indexOf(language) > -1) {
                return language;
            }
        }
        return "";
    }


    function getLanguage() {
        var defaultLanguage = "english";
        // Try to get from existing phrase
        var language = getLanguageFromPhrase();
        // Try to get from url if not from phrase
        if (language.length == 0) {
            language = getLanguageFromUrl();
        }
        // Default to English if no other option
        if (language.length == 0) {
            language = defaultLanguage;
        }
        return language;
    }

    function findPhraseErrors(phrase) {
        // Preprocess the words
        phrase = mnemonic.normalizeString(phrase);
        var words = phraseToWordArray(phrase);
        // Detect blank phrase
        if (words.length == 0) {
            return "Blank mnemonic";
        }
        // Check each word
        for (var i=0; i<words.length; i++) {
            var word = words[i];
            var language = getLanguage();
            if (WORDLISTS[language].indexOf(word) == -1) {
                console.log("Finding closest match to " + word);
                var nearestWord = findNearestWord(word);
                return word + " not in wordlist, did you mean " + nearestWord + "?";
            }
        }
        // Check the words are valid
        var properPhrase = wordArrayToPhrase(words);
        var isValid = mnemonic.check(properPhrase);
        if (!isValid) {
            return "Invalid mnemonic";
        }
        return false;
    }


    function btc_electrum_wallet(xprv, xpub) {
        var wallet = {
            "addr_history": {},
            "addresses": {
                "change": [],
                "receiving": []
            },
            "keystore": {
                "pw_hash_version": 1,
                "type": "bip32",
                "xprv": xprv,
                "xpub": xpub
            },
            "seed_type": "bip39",
            "seed_version": 18,
            "spent_outpoints": {},
            "stored_height": 1,
            "transactions": {},
            "tx_fees": {},
            "txi": {},
            "txo": {},
            "use_encryption": false,
            "verified_tx3": {},
            "wallet_type": "standard",
            "winpos-qt": []
        };

        return JSON.stringify(wallet, undefined, 2);
    }

    function ltc_electrum_wallet(xprv, xpub) {
        var wallet = {
            "addr_history": {},
            "addresses": {
                "change": [],
                "receiving": []
            },
            "keystore": {
                "type": "bip32",
                "xprv": xprv,
                "xpub": xpub
            },
            "pruned_txo": {},
            "seed_type": "bip39",
            "seed_version": 16,
            "transactions": {},
            "tx_fees": {},
            "txi": {},
            "txo": {},
            "use_encryption": false,
            "wallet_type": "standard"
        };

        return JSON.stringify(wallet, undefined, 2);
    }

    function bch_electrum_wallet(xprv, xpub) {
        var wallet = {
                "addr_history": {},
                "addresses": {
                    "change": [],
                    "receiving": []
                },
                "keystore": {
                    "type": "bip32",
                    "xprv": xprv,
                    "xpub": xpub
                },
                "pruned_txo": {},
                "seed_type": "bip39",
                "seed_version": 17,
                "transactions": {},
                "tx_fees": {},
                "txi": {},
                "txo": {},
                "use_encryption": false,
                "verified_tx3": {},
                "wallet_type": "standard"
            };

        return JSON.stringify(wallet, undefined, 2);
    }

    function dash_electrum_wallet(xprv, xpub) {
        var wallet = {
                "addr_history": {},
                "addresses": {
                    "change": [],
                    "receiving": []
                },
                "keystore": {
                    "type": "bip32",
                    "xprv": xprv,
                    "xpub": xpub
                },
                "seed_type": "bip39",
                "seed_version": 18,
                "spent_outpoints": {},
                "transactions": {},
                "tx_fees": {},
                "txi": {},
                "txo": {},
                "use_encryption": false,
                "verified_tx3": {},
                "wallet_type": "standard"
            };

        return JSON.stringify(wallet, undefined, 2);
    }

    function cryptopanel_config() {
        var cfg = {
            "BTC": btc_pub_key,
            "LTC": ltc_pub_key,
            "BCH": bch_pub_key,
            "DASH": dash_pub_key

        };

        return JSON.stringify(cfg, undefined, 2);
    }


    function generate() {
        var phrase = generateRandomPhrase();
        if (!phrase) {
            return;
        }

        $(el_phrase).val(phrase);
        document.querySelector('.mdl-js-textfield').MaterialTextfield.checkDirty();
        phraseChanged();
    }

    function phraseChanged() {
        var errorText = findPhraseErrors(el_phrase.val());
        if (errorText) {
            showValidationError(errorText);
            return;
        }

        calcBip32RootKeyFromSeed(el_phrase.val());
    }

    function download() {
        var zip = new JSZip();
        zip.file("seed-und-privatekey.txt", "Seed Phrase: " + el_phrase.val() +"\r\n\n" +
            "BTC Private Key: "+btc_priv_key+"\r\n" +
            "BTC Public Key: "+btc_pub_key+"\r\n" +
            "LTC Private Key: "+ltc_priv_key+"\r\n" +
            "LTC Public Key: "+ltc_pub_key+"\r\n" +
            "DASH Private Key: "+dash_priv_key+"\r\n" +
            "DASH Public Key: "+dash_pub_key+"\r\n" +
            "BCH Private Key: "+bch_priv_key+"\r\n" +
            "BCH Public Key: "+bch_pub_key+"\r\n" +
            "");

        zip.file("public-keys-crypto-panel.json", cryptopanel_config());

        var wallets = zip.folder("electrum-wallets");
        wallets.file("btc_electrum_wallet.dat", btc_electrum_wallet(btc_priv_key, btc_pub_key));
        wallets.file("ltc_electrum_wallet.dat", ltc_electrum_wallet(ltc_priv_key, ltc_pub_key));
        wallets.file("bch_electrum_wallet.dat", bch_electrum_wallet(bch_priv_key, bch_pub_key));
        wallets.file("dash_electrum_wallet.dat", dash_electrum_wallet(dash_priv_key, dash_pub_key));

        zip.generateAsync({type:"blob"})
            .then(function (blob) {
                saveAs(blob, "CryptoSeed.zip");
            });
    }

    new ClipboardJS('.btn-clipboard');


    $('#download').on('click', download);
    $('#generate').on('click', generate);
    //el_phrase.on('change', phraseChanged);
})();
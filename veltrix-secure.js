// ==UserScript==
// @name         Veltrix Secure Container
// @namespace    veltrix
// @version      1.0
// @description  Isole toute l'UI de VeltrixJS dans un Shadow DOM fermé
// @match        https://narrow.one/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ─── ID aléatoire pour ne pas être fingerprinté ───
    const HOST_ID = 'vx_' + Math.random().toString(36).slice(2, 12);
    const SHADOW_KEY = '__vx_shadow_' + Math.random().toString(36).slice(2, 8);

    // ─── Hooker attachShadow avant tout le monde ───
    const _origAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function(init) {
        return _origAttachShadow.call(this, init);
    };
    Element.prototype.attachShadow.toString = function() {
        return 'function attachShadow() { [native code] }';
    };

    // ─── Créer le host + shadow fermé ───
    let host = null;
    let shadow = null;

    function ensureShadow() {
        if (shadow) return shadow;
        if (!document.documentElement) return null;

        host = document.createElement('div');
        host.id = HOST_ID;
        host.style.cssText = [
            'position:fixed',
            'top:0',
            'left:0',
            'width:0',
            'height:0',
            'overflow:visible',
            'pointer-events:none',
            'z-index:2147483647',
            'contain:layout style'
        ].join(';');

        shadow = host.attachShadow({ mode: 'closed' });

        // Styles de base
        const baseStyle = document.createElement('style');
        baseStyle.textContent = `
            :host { all: initial; font-family: 'Segoe UI', sans-serif; }
            *, *::before, *::after { box-sizing: border-box; }
        `;
        shadow.appendChild(baseStyle);

        document.documentElement.appendChild(host);
        return shadow;
    }

    // ─── Rediriger les appendChild vers le shadow ───
    const _origAppendChild = Node.prototype.appendChild;

    // Liste blanche : éléments qui doivent rester dans document.body
    const ALLOWLIST_TAGS = new Set(['SCRIPT', 'LINK', 'STYLE', 'META']);

    Node.prototype.appendChild = function(child) {
        // Si c'est document.body ou document.head qui reçoit un élément de l'UI Veltrix
        if ((this === document.body || this === document.head) && child && child.nodeType === 1) {
            // Ne pas rediriger les scripts/styles/links (nécessaires au head)
            if (ALLOWLIST_TAGS.has(child.tagName)) {
                return _origAppendChild.call(this, child);
            }

            // Ne pas rediriger les canvas du jeu (le jeu en ajoute)
            if (child.tagName === 'CANVAS' && !child.id) {
                return _origAppendChild.call(this, child);
            }

            // Ne pas rediriger les éléments du jeu (classes spécifiques)
            if (child.className && typeof child.className === 'string') {
                const cls = child.className.toLowerCase();
                if (cls.includes('game') || cls.includes('poki') || cls.includes('narrow')) {
                    return _origAppendChild.call(this, child);
                }
            }

            // Rediriger vers le shadow
            const s = ensureShadow();
            if (s) {
                // Donner pointer-events auto aux éléments UI
                if (child.style) {
                    child.style.pointerEvents = 'auto';
                }
                return _origAppendChild.call(s, child);
            }
        }

        return _origAppendChild.call(this, child);
    };

    // Protéger le hook
    Node.prototype.appendChild.toString = function() {
        return 'function appendChild() { [native code] }';
    };

    // ─── Rediriger insertBefore aussi ───
    const _origInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function(newNode, refNode) {
        if ((this === document.body || this === document.head) && newNode && newNode.nodeType === 1) {
            if (!ALLOWLIST_TAGS.has(newNode.tagName) && !(newNode.tagName === 'CANVAS' && !newNode.id)) {
                const s = ensureShadow();
                if (s) {
                    if (newNode.style) newNode.style.pointerEvents = 'auto';
                    return _origAppendChild.call(s, newNode);
                }
            }
        }
        return _origInsertBefore.call(this, newNode, refNode);
    };
    Node.prototype.insertBefore.toString = function() {
        return 'function insertBefore() { [native code] }';
    };

    // ─── Rediriger querySelector pour trouver dans le shadow ───
    const _origQS = Document.prototype.querySelector;
    const _origQSA = Document.prototype.querySelectorAll;
    const _origGEBI = Document.prototype.getElementById;

    Document.prototype.querySelector = function(sel) {
        const r = _origQS.call(this, sel);
        if (r) return r;
        if (shadow) {
            try { return shadow.querySelector(sel); } catch(e) {}
        }
        return null;
    };

    Document.prototype.querySelectorAll = function(sel) {
        const r = Array.from(_origQSA.call(this, sel));
        if (shadow) {
            try {
                shadow.querySelectorAll(sel).forEach(el => {
                    if (!r.includes(el)) r.push(el);
                });
            } catch(e) {}
        }
        return r;
    };

    Document.prototype.getElementById = function(id) {
        const r = _origGEBI.call(this, id);
        if (r) return r;
        if (shadow) {
            try { return shadow.getElementById(id); } catch(e) {}
        }
        return null;
    };

    // Protéger les hooks
    Document.prototype.querySelector.toString = function() { return 'function querySelector() { [native code] }'; };
    Document.prototype.querySelectorAll.toString = function() { return 'function querySelectorAll() { [native code] }'; };
    Document.prototype.getElementById.toString = function() { return 'function getElementById() { [native code] }'; };

    // ─── API publique ───
    window.__vx = {
        get shadow() { return ensureShadow(); },
        get host() { return host; }
    };
})();
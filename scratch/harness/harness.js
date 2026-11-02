"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e2) {
      throw err = [e2], e2;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e2) {
      throw mod = 0, e2;
    }
  };

  // ../../node_modules/@vscode-elements/elements/dist/bundled.js
  function X(t2, e2) {
    if (!j(t2) || !t2.hasOwnProperty("raw")) throw Error("invalid template strings array");
    return void 0 !== S ? S.createHTML(e2) : e2;
  }
  function Z(t2, e2, i2 = t2, s2) {
    if (e2 === G) return e2;
    let o2 = void 0 !== s2 ? i2._$Co?.[s2] : i2._$Cl;
    const r2 = I(e2) ? void 0 : e2._$litDirective$;
    return o2?.constructor !== r2 && (o2?._$AO?.(false), void 0 === r2 ? o2 = void 0 : (o2 = new r2(t2), o2._$AT(t2, i2, s2)), void 0 !== s2 ? (i2._$Co ??= [])[s2] = o2 : i2._$Cl = o2), void 0 !== o2 && (e2 = Z(t2, o2._$AS(t2, e2.values), o2, s2)), e2;
  }
  function pt(t2) {
    return (e2, i2) => "object" == typeof i2 ? ut(t2, e2, i2) : ((t3, e3, i3) => {
      const s2 = e3.hasOwnProperty(i3);
      return e3.constructor.createProperty(i3, t3), s2 ? Object.getOwnPropertyDescriptor(e3, i3) : void 0;
    })(t2, e2, i2);
  }
  function vt(t2) {
    return pt({ ...t2, state: true, attribute: false });
  }
  function ft(t2, e2) {
    return (i2, s2, o2) => {
      const r2 = (e3) => e3.renderRoot?.querySelector(t2) ?? null;
      if (e2) {
        const { get: t3, set: e3 } = "object" == typeof s2 ? i2 : o2 ?? /* @__PURE__ */ (() => {
          const t4 = /* @__PURE__ */ Symbol();
          return { get() {
            return this[t4];
          }, set(e4) {
            this[t4] = e4;
          } };
        })();
        return bt(0, 0, { get() {
          let i3 = t3.call(this);
          return void 0 === i3 && (i3 = r2(this), (null !== i3 || this.hasUpdated) && e3.call(this, i3)), i3;
        } });
      }
      return bt(0, 0, { get() {
        return r2(this);
      } });
    };
  }
  function mt(t2) {
    return (e2, i2) => {
      const { slot: s2, selector: o2 } = t2 ?? {}, r2 = "slot" + (s2 ? `[name=${s2}]` : ":not([name])");
      return bt(0, 0, { get() {
        const e3 = this.renderRoot?.querySelector(r2), i3 = e3?.assignedElements(t2) ?? [];
        return void 0 === o2 ? i3 : i3.filter(((t3) => t3.matches(o2)));
      } });
    };
  }
  function St() {
    return navigator.userAgent.indexOf("Linux") > -1 ? 'system-ui, "Ubuntu", "Droid Sans", sans-serif' : navigator.userAgent.indexOf("Mac") > -1 ? "-apple-system, BlinkMacSystemFont, sans-serif" : navigator.userAgent.indexOf("Windows") > -1 ? '"Segoe WPC", "Segoe UI", sans-serif' : "sans-serif";
  }
  function ws({ context: t2 }) {
    return (e2, i2) => {
      const s2 = /* @__PURE__ */ new WeakMap();
      if ("object" == typeof i2) return { get() {
        return e2.get.call(this);
      }, set(t3) {
        return s2.get(this).setValue(t3), e2.set.call(this, t3);
      }, init(e3) {
        return s2.set(this, new xs(this, { context: t2, initialValue: e3 })), e3;
      } };
      {
        e2.constructor.addInitializer(((e3) => {
          s2.set(e3, new xs(e3, { context: t2 }));
        }));
        const o2 = Object.getOwnPropertyDescriptor(e2, i2);
        let r2;
        if (void 0 === o2) {
          const t3 = /* @__PURE__ */ new WeakMap();
          r2 = { get() {
            return t3.get(this);
          }, set(e3) {
            s2.get(this).setValue(e3), t3.set(this, e3);
          }, configurable: true, enumerable: true };
        } else {
          const t3 = o2.set;
          r2 = { ...o2, set(e3) {
            s2.get(this).setValue(e3), t3?.call(this, e3);
          } };
        }
        return void Object.defineProperty(e2, i2, r2);
      }
    };
  }
  function ys({ context: t2, subscribe: e2 }) {
    return (i2, s2) => {
      "object" == typeof s2 ? s2.addInitializer((function() {
        new fs(this, { context: t2, callback: (t3) => {
          i2.set.call(this, t3);
        }, subscribe: e2 });
      })) : i2.constructor.addInitializer(((i3) => {
        new fs(i3, { context: t2, callback: (t3) => {
          i3[s2] = t3;
        }, subscribe: e2 });
      }));
    };
  }
  function zs(t2) {
    return t2.parentElement && Ss(t2.parentElement) ? t2.parentElement : null;
  }
  function Rs(t2) {
    return t2.parentElement && t2.parentElement instanceof Ls ? t2.parentElement : null;
  }
  var t, e, i, s, o, r, n, h, a, l, c, d, u, p, v, b, f, g, m, x, w, y, k, $, _, S, C, B, A, O, z, E, I, j, M, D, F, P, V, N, T, R, L, U, H, G, q, W, K, J, Y, Q, tt, et, it, st, ot, rt, nt, ht, at, lt, ct, dt, ut, bt, gt, xt, wt, yt, kt, $t, _t, Ct, Bt, At, Ot, zt, Et, It, jt, Mt, Dt, Ft, Pt, Vt, Nt, Tt, Rt, Lt, Ut, Ht, Gt, qt, Wt, Kt, Xt, Jt, Yt, Zt, Qt, te, ee, ie, se, oe, re, ne, he, ae, le, ce, de, ue, pe, ve, be, fe, ge, me, xe, we, ye, ke, $e, _e, Se, Ce, Be, Ae, Oe, ze, Ee, Ie, je, Me, De, Fe, Pe, Ve, Ne, Te, Re, Le, Ue, He, Ge, qe, We, Ke, Xe, Je, Ye, Ze, Qe, ti, ei, ii, si, oi, ri, ni, hi, ai, li, ci, di, ui, pi, vi, bi, fi, gi, mi, xi, wi, yi, ki, $i, _i, Si, Ci, Bi, Ai, Oi, zi, Ei, Ii, ji, Mi, Di, Fi, Pi, Vi, Ni, Ti, Ri, Li, Ui, Hi, Gi, qi, Wi, Ki, Xi, Ji, Yi, Zi, Qi, ts, es, is, ss, os, rs, ns, hs, as, ls, cs, ds, us, ps, vs, bs, fs, gs, ms, xs, ks, $s, _s, Ss, Cs, Bs, As, Os, Es, Is, js, Ms, Ds, Fs, Ps, Vs, Ns, Ts, Ls;
  var init_bundled = __esm({
    "../../node_modules/@vscode-elements/elements/dist/bundled.js"() {
      t = globalThis;
      e = t.ShadowRoot && (void 0 === t.ShadyCSS || t.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
      i = /* @__PURE__ */ Symbol();
      s = /* @__PURE__ */ new WeakMap();
      o = class {
        constructor(t2, e2, s2) {
          if (this._$cssResult$ = true, s2 !== i) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
          this.cssText = t2, this.t = e2;
        }
        get styleSheet() {
          let t2 = this.o;
          const i2 = this.t;
          if (e && void 0 === t2) {
            const e2 = void 0 !== i2 && 1 === i2.length;
            e2 && (t2 = s.get(i2)), void 0 === t2 && ((this.o = t2 = new CSSStyleSheet()).replaceSync(this.cssText), e2 && s.set(i2, t2));
          }
          return t2;
        }
        toString() {
          return this.cssText;
        }
      };
      r = (t2) => new o("string" == typeof t2 ? t2 : t2 + "", void 0, i);
      n = (t2, ...e2) => {
        const s2 = 1 === t2.length ? t2[0] : e2.reduce(((e3, i2, s3) => e3 + ((t3) => {
          if (true === t3._$cssResult$) return t3.cssText;
          if ("number" == typeof t3) return t3;
          throw Error("Value passed to 'css' function must be a 'css' function result: " + t3 + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
        })(i2) + t2[s3 + 1]), t2[0]);
        return new o(s2, t2, i);
      };
      h = e ? (t2) => t2 : (t2) => t2 instanceof CSSStyleSheet ? ((t3) => {
        let e2 = "";
        for (const i2 of t3.cssRules) e2 += i2.cssText;
        return r(e2);
      })(t2) : t2;
      ({ is: a, defineProperty: l, getOwnPropertyDescriptor: c, getOwnPropertyNames: d, getOwnPropertySymbols: u, getPrototypeOf: p } = Object);
      v = globalThis;
      b = v.trustedTypes;
      f = b ? b.emptyScript : "";
      g = v.reactiveElementPolyfillSupport;
      m = (t2, e2) => t2;
      x = { toAttribute(t2, e2) {
        switch (e2) {
          case Boolean:
            t2 = t2 ? f : null;
            break;
          case Object:
          case Array:
            t2 = null == t2 ? t2 : JSON.stringify(t2);
        }
        return t2;
      }, fromAttribute(t2, e2) {
        let i2 = t2;
        switch (e2) {
          case Boolean:
            i2 = null !== t2;
            break;
          case Number:
            i2 = null === t2 ? null : Number(t2);
            break;
          case Object:
          case Array:
            try {
              i2 = JSON.parse(t2);
            } catch (t3) {
              i2 = null;
            }
        }
        return i2;
      } };
      w = (t2, e2) => !a(t2, e2);
      y = { attribute: true, type: String, converter: x, reflect: false, useDefault: false, hasChanged: w };
      Symbol.metadata ??= /* @__PURE__ */ Symbol("metadata"), v.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
      k = class extends HTMLElement {
        static addInitializer(t2) {
          this._$Ei(), (this.l ??= []).push(t2);
        }
        static get observedAttributes() {
          return this.finalize(), this._$Eh && [...this._$Eh.keys()];
        }
        static createProperty(t2, e2 = y) {
          if (e2.state && (e2.attribute = false), this._$Ei(), this.prototype.hasOwnProperty(t2) && ((e2 = Object.create(e2)).wrapped = true), this.elementProperties.set(t2, e2), !e2.noAccessor) {
            const i2 = /* @__PURE__ */ Symbol(), s2 = this.getPropertyDescriptor(t2, i2, e2);
            void 0 !== s2 && l(this.prototype, t2, s2);
          }
        }
        static getPropertyDescriptor(t2, e2, i2) {
          const { get: s2, set: o2 } = c(this.prototype, t2) ?? { get() {
            return this[e2];
          }, set(t3) {
            this[e2] = t3;
          } };
          return { get: s2, set(e3) {
            const r2 = s2?.call(this);
            o2?.call(this, e3), this.requestUpdate(t2, r2, i2);
          }, configurable: true, enumerable: true };
        }
        static getPropertyOptions(t2) {
          return this.elementProperties.get(t2) ?? y;
        }
        static _$Ei() {
          if (this.hasOwnProperty(m("elementProperties"))) return;
          const t2 = p(this);
          t2.finalize(), void 0 !== t2.l && (this.l = [...t2.l]), this.elementProperties = new Map(t2.elementProperties);
        }
        static finalize() {
          if (this.hasOwnProperty(m("finalized"))) return;
          if (this.finalized = true, this._$Ei(), this.hasOwnProperty(m("properties"))) {
            const t3 = this.properties, e2 = [...d(t3), ...u(t3)];
            for (const i2 of e2) this.createProperty(i2, t3[i2]);
          }
          const t2 = this[Symbol.metadata];
          if (null !== t2) {
            const e2 = litPropertyMetadata.get(t2);
            if (void 0 !== e2) for (const [t3, i2] of e2) this.elementProperties.set(t3, i2);
          }
          this._$Eh = /* @__PURE__ */ new Map();
          for (const [t3, e2] of this.elementProperties) {
            const i2 = this._$Eu(t3, e2);
            void 0 !== i2 && this._$Eh.set(i2, t3);
          }
          this.elementStyles = this.finalizeStyles(this.styles);
        }
        static finalizeStyles(t2) {
          const e2 = [];
          if (Array.isArray(t2)) {
            const i2 = new Set(t2.flat(1 / 0).reverse());
            for (const t3 of i2) e2.unshift(h(t3));
          } else void 0 !== t2 && e2.push(h(t2));
          return e2;
        }
        static _$Eu(t2, e2) {
          const i2 = e2.attribute;
          return false === i2 ? void 0 : "string" == typeof i2 ? i2 : "string" == typeof t2 ? t2.toLowerCase() : void 0;
        }
        constructor() {
          super(), this._$Ep = void 0, this.isUpdatePending = false, this.hasUpdated = false, this._$Em = null, this._$Ev();
        }
        _$Ev() {
          this._$ES = new Promise(((t2) => this.enableUpdating = t2)), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach(((t2) => t2(this)));
        }
        addController(t2) {
          (this._$EO ??= /* @__PURE__ */ new Set()).add(t2), void 0 !== this.renderRoot && this.isConnected && t2.hostConnected?.();
        }
        removeController(t2) {
          this._$EO?.delete(t2);
        }
        _$E_() {
          const t2 = /* @__PURE__ */ new Map(), e2 = this.constructor.elementProperties;
          for (const i2 of e2.keys()) this.hasOwnProperty(i2) && (t2.set(i2, this[i2]), delete this[i2]);
          t2.size > 0 && (this._$Ep = t2);
        }
        createRenderRoot() {
          const i2 = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
          return ((i3, s2) => {
            if (e) i3.adoptedStyleSheets = s2.map(((t2) => t2 instanceof CSSStyleSheet ? t2 : t2.styleSheet));
            else for (const e2 of s2) {
              const s3 = document.createElement("style"), o2 = t.litNonce;
              void 0 !== o2 && s3.setAttribute("nonce", o2), s3.textContent = e2.cssText, i3.appendChild(s3);
            }
          })(i2, this.constructor.elementStyles), i2;
        }
        connectedCallback() {
          this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(true), this._$EO?.forEach(((t2) => t2.hostConnected?.()));
        }
        enableUpdating(t2) {
        }
        disconnectedCallback() {
          this._$EO?.forEach(((t2) => t2.hostDisconnected?.()));
        }
        attributeChangedCallback(t2, e2, i2) {
          this._$AK(t2, i2);
        }
        _$ET(t2, e2) {
          const i2 = this.constructor.elementProperties.get(t2), s2 = this.constructor._$Eu(t2, i2);
          if (void 0 !== s2 && true === i2.reflect) {
            const o2 = (void 0 !== i2.converter?.toAttribute ? i2.converter : x).toAttribute(e2, i2.type);
            this._$Em = t2, null == o2 ? this.removeAttribute(s2) : this.setAttribute(s2, o2), this._$Em = null;
          }
        }
        _$AK(t2, e2) {
          const i2 = this.constructor, s2 = i2._$Eh.get(t2);
          if (void 0 !== s2 && this._$Em !== s2) {
            const t3 = i2.getPropertyOptions(s2), o2 = "function" == typeof t3.converter ? { fromAttribute: t3.converter } : void 0 !== t3.converter?.fromAttribute ? t3.converter : x;
            this._$Em = s2, this[s2] = o2.fromAttribute(e2, t3.type) ?? this._$Ej?.get(s2) ?? null, this._$Em = null;
          }
        }
        requestUpdate(t2, e2, i2) {
          if (void 0 !== t2) {
            const s2 = this.constructor, o2 = this[t2];
            if (i2 ??= s2.getPropertyOptions(t2), !((i2.hasChanged ?? w)(o2, e2) || i2.useDefault && i2.reflect && o2 === this._$Ej?.get(t2) && !this.hasAttribute(s2._$Eu(t2, i2)))) return;
            this.C(t2, e2, i2);
          }
          false === this.isUpdatePending && (this._$ES = this._$EP());
        }
        C(t2, e2, { useDefault: i2, reflect: s2, wrapped: o2 }, r2) {
          i2 && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t2) && (this._$Ej.set(t2, r2 ?? e2 ?? this[t2]), true !== o2 || void 0 !== r2) || (this._$AL.has(t2) || (this.hasUpdated || i2 || (e2 = void 0), this._$AL.set(t2, e2)), true === s2 && this._$Em !== t2 && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t2));
        }
        async _$EP() {
          this.isUpdatePending = true;
          try {
            await this._$ES;
          } catch (t3) {
            Promise.reject(t3);
          }
          const t2 = this.scheduleUpdate();
          return null != t2 && await t2, !this.isUpdatePending;
        }
        scheduleUpdate() {
          return this.performUpdate();
        }
        performUpdate() {
          if (!this.isUpdatePending) return;
          if (!this.hasUpdated) {
            if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
              for (const [t4, e3] of this._$Ep) this[t4] = e3;
              this._$Ep = void 0;
            }
            const t3 = this.constructor.elementProperties;
            if (t3.size > 0) for (const [e3, i2] of t3) {
              const { wrapped: t4 } = i2, s2 = this[e3];
              true !== t4 || this._$AL.has(e3) || void 0 === s2 || this.C(e3, void 0, i2, s2);
            }
          }
          let t2 = false;
          const e2 = this._$AL;
          try {
            t2 = this.shouldUpdate(e2), t2 ? (this.willUpdate(e2), this._$EO?.forEach(((t3) => t3.hostUpdate?.())), this.update(e2)) : this._$EM();
          } catch (e3) {
            throw t2 = false, this._$EM(), e3;
          }
          t2 && this._$AE(e2);
        }
        willUpdate(t2) {
        }
        _$AE(t2) {
          this._$EO?.forEach(((t3) => t3.hostUpdated?.())), this.hasUpdated || (this.hasUpdated = true, this.firstUpdated(t2)), this.updated(t2);
        }
        _$EM() {
          this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = false;
        }
        get updateComplete() {
          return this.getUpdateComplete();
        }
        getUpdateComplete() {
          return this._$ES;
        }
        shouldUpdate(t2) {
          return true;
        }
        update(t2) {
          this._$Eq &&= this._$Eq.forEach(((t3) => this._$ET(t3, this[t3]))), this._$EM();
        }
        updated(t2) {
        }
        firstUpdated(t2) {
        }
      };
      k.elementStyles = [], k.shadowRootOptions = { mode: "open" }, k[m("elementProperties")] = /* @__PURE__ */ new Map(), k[m("finalized")] = /* @__PURE__ */ new Map(), g?.({ ReactiveElement: k }), (v.reactiveElementVersions ??= []).push("2.1.0");
      $ = globalThis;
      _ = $.trustedTypes;
      S = _ ? _.createPolicy("lit-html", { createHTML: (t2) => t2 }) : void 0;
      C = "$lit$";
      B = `lit$${Math.random().toFixed(9).slice(2)}$`;
      A = "?" + B;
      O = `<${A}>`;
      z = document;
      E = () => z.createComment("");
      I = (t2) => null === t2 || "object" != typeof t2 && "function" != typeof t2;
      j = Array.isArray;
      M = "[ 	\n\f\r]";
      D = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
      F = /-->/g;
      P = />/g;
      V = RegExp(`>|${M}(?:([^\\s"'>=/]+)(${M}*=${M}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
      N = /'/g;
      T = /"/g;
      R = /^(?:script|style|textarea|title)$/i;
      L = (t2) => (e2, ...i2) => ({ _$litType$: t2, strings: e2, values: i2 });
      U = L(1);
      H = L(2);
      G = /* @__PURE__ */ Symbol.for("lit-noChange");
      q = /* @__PURE__ */ Symbol.for("lit-nothing");
      W = /* @__PURE__ */ new WeakMap();
      K = z.createTreeWalker(z, 129);
      J = (t2, e2) => {
        const i2 = t2.length - 1, s2 = [];
        let o2, r2 = 2 === e2 ? "<svg>" : 3 === e2 ? "<math>" : "", n2 = D;
        for (let e3 = 0; e3 < i2; e3++) {
          const i3 = t2[e3];
          let h2, a2, l2 = -1, c2 = 0;
          for (; c2 < i3.length && (n2.lastIndex = c2, a2 = n2.exec(i3), null !== a2); ) c2 = n2.lastIndex, n2 === D ? "!--" === a2[1] ? n2 = F : void 0 !== a2[1] ? n2 = P : void 0 !== a2[2] ? (R.test(a2[2]) && (o2 = RegExp("</" + a2[2], "g")), n2 = V) : void 0 !== a2[3] && (n2 = V) : n2 === V ? ">" === a2[0] ? (n2 = o2 ?? D, l2 = -1) : void 0 === a2[1] ? l2 = -2 : (l2 = n2.lastIndex - a2[2].length, h2 = a2[1], n2 = void 0 === a2[3] ? V : '"' === a2[3] ? T : N) : n2 === T || n2 === N ? n2 = V : n2 === F || n2 === P ? n2 = D : (n2 = V, o2 = void 0);
          const d2 = n2 === V && t2[e3 + 1].startsWith("/>") ? " " : "";
          r2 += n2 === D ? i3 + O : l2 >= 0 ? (s2.push(h2), i3.slice(0, l2) + C + i3.slice(l2) + B + d2) : i3 + B + (-2 === l2 ? e3 : d2);
        }
        return [X(t2, r2 + (t2[i2] || "<?>") + (2 === e2 ? "</svg>" : 3 === e2 ? "</math>" : "")), s2];
      };
      Y = class _Y {
        constructor({ strings: t2, _$litType$: e2 }, i2) {
          let s2;
          this.parts = [];
          let o2 = 0, r2 = 0;
          const n2 = t2.length - 1, h2 = this.parts, [a2, l2] = J(t2, e2);
          if (this.el = _Y.createElement(a2, i2), K.currentNode = this.el.content, 2 === e2 || 3 === e2) {
            const t3 = this.el.content.firstChild;
            t3.replaceWith(...t3.childNodes);
          }
          for (; null !== (s2 = K.nextNode()) && h2.length < n2; ) {
            if (1 === s2.nodeType) {
              if (s2.hasAttributes()) for (const t3 of s2.getAttributeNames()) if (t3.endsWith(C)) {
                const e3 = l2[r2++], i3 = s2.getAttribute(t3).split(B), n3 = /([.?@])?(.*)/.exec(e3);
                h2.push({ type: 1, index: o2, name: n3[2], strings: i3, ctor: "." === n3[1] ? et : "?" === n3[1] ? it : "@" === n3[1] ? st : tt }), s2.removeAttribute(t3);
              } else t3.startsWith(B) && (h2.push({ type: 6, index: o2 }), s2.removeAttribute(t3));
              if (R.test(s2.tagName)) {
                const t3 = s2.textContent.split(B), e3 = t3.length - 1;
                if (e3 > 0) {
                  s2.textContent = _ ? _.emptyScript : "";
                  for (let i3 = 0; i3 < e3; i3++) s2.append(t3[i3], E()), K.nextNode(), h2.push({ type: 2, index: ++o2 });
                  s2.append(t3[e3], E());
                }
              }
            } else if (8 === s2.nodeType) if (s2.data === A) h2.push({ type: 2, index: o2 });
            else {
              let t3 = -1;
              for (; -1 !== (t3 = s2.data.indexOf(B, t3 + 1)); ) h2.push({ type: 7, index: o2 }), t3 += B.length - 1;
            }
            o2++;
          }
        }
        static createElement(t2, e2) {
          const i2 = z.createElement("template");
          return i2.innerHTML = t2, i2;
        }
      };
      Q = class _Q {
        get _$AU() {
          return this._$AM?._$AU ?? this._$Cv;
        }
        constructor(t2, e2, i2, s2) {
          this.type = 2, this._$AH = q, this._$AN = void 0, this._$AA = t2, this._$AB = e2, this._$AM = i2, this.options = s2, this._$Cv = s2?.isConnected ?? true;
        }
        get parentNode() {
          let t2 = this._$AA.parentNode;
          const e2 = this._$AM;
          return void 0 !== e2 && 11 === t2?.nodeType && (t2 = e2.parentNode), t2;
        }
        get startNode() {
          return this._$AA;
        }
        get endNode() {
          return this._$AB;
        }
        _$AI(t2, e2 = this) {
          t2 = Z(this, t2, e2), I(t2) ? t2 === q || null == t2 || "" === t2 ? (this._$AH !== q && this._$AR(), this._$AH = q) : t2 !== this._$AH && t2 !== G && this._(t2) : void 0 !== t2._$litType$ ? this.$(t2) : void 0 !== t2.nodeType ? this.T(t2) : ((t3) => j(t3) || "function" == typeof t3?.[Symbol.iterator])(t2) ? this.k(t2) : this._(t2);
        }
        O(t2) {
          return this._$AA.parentNode.insertBefore(t2, this._$AB);
        }
        T(t2) {
          this._$AH !== t2 && (this._$AR(), this._$AH = this.O(t2));
        }
        _(t2) {
          this._$AH !== q && I(this._$AH) ? this._$AA.nextSibling.data = t2 : this.T(z.createTextNode(t2)), this._$AH = t2;
        }
        $(t2) {
          const { values: e2, _$litType$: i2 } = t2, s2 = "number" == typeof i2 ? this._$AC(t2) : (void 0 === i2.el && (i2.el = Y.createElement(X(i2.h, i2.h[0]), this.options)), i2);
          if (this._$AH?._$AD === s2) this._$AH.p(e2);
          else {
            const t3 = new class {
              constructor(t4, e3) {
                this._$AV = [], this._$AN = void 0, this._$AD = t4, this._$AM = e3;
              }
              get parentNode() {
                return this._$AM.parentNode;
              }
              get _$AU() {
                return this._$AM._$AU;
              }
              u(t4) {
                const { el: { content: e3 }, parts: i4 } = this._$AD, s3 = (t4?.creationScope ?? z).importNode(e3, true);
                K.currentNode = s3;
                let o2 = K.nextNode(), r2 = 0, n2 = 0, h2 = i4[0];
                for (; void 0 !== h2; ) {
                  if (r2 === h2.index) {
                    let e4;
                    2 === h2.type ? e4 = new _Q(o2, o2.nextSibling, this, t4) : 1 === h2.type ? e4 = new h2.ctor(o2, h2.name, h2.strings, this, t4) : 6 === h2.type && (e4 = new ot(o2, this, t4)), this._$AV.push(e4), h2 = i4[++n2];
                  }
                  r2 !== h2?.index && (o2 = K.nextNode(), r2++);
                }
                return K.currentNode = z, s3;
              }
              p(t4) {
                let e3 = 0;
                for (const i4 of this._$AV) void 0 !== i4 && (void 0 !== i4.strings ? (i4._$AI(t4, i4, e3), e3 += i4.strings.length - 2) : i4._$AI(t4[e3])), e3++;
              }
            }(s2, this), i3 = t3.u(this.options);
            t3.p(e2), this.T(i3), this._$AH = t3;
          }
        }
        _$AC(t2) {
          let e2 = W.get(t2.strings);
          return void 0 === e2 && W.set(t2.strings, e2 = new Y(t2)), e2;
        }
        k(t2) {
          j(this._$AH) || (this._$AH = [], this._$AR());
          const e2 = this._$AH;
          let i2, s2 = 0;
          for (const o2 of t2) s2 === e2.length ? e2.push(i2 = new _Q(this.O(E()), this.O(E()), this, this.options)) : i2 = e2[s2], i2._$AI(o2), s2++;
          s2 < e2.length && (this._$AR(i2 && i2._$AB.nextSibling, s2), e2.length = s2);
        }
        _$AR(t2 = this._$AA.nextSibling, e2) {
          for (this._$AP?.(false, true, e2); t2 && t2 !== this._$AB; ) {
            const e3 = t2.nextSibling;
            t2.remove(), t2 = e3;
          }
        }
        setConnected(t2) {
          void 0 === this._$AM && (this._$Cv = t2, this._$AP?.(t2));
        }
      };
      tt = class {
        get tagName() {
          return this.element.tagName;
        }
        get _$AU() {
          return this._$AM._$AU;
        }
        constructor(t2, e2, i2, s2, o2) {
          this.type = 1, this._$AH = q, this._$AN = void 0, this.element = t2, this.name = e2, this._$AM = s2, this.options = o2, i2.length > 2 || "" !== i2[0] || "" !== i2[1] ? (this._$AH = Array(i2.length - 1).fill(new String()), this.strings = i2) : this._$AH = q;
        }
        _$AI(t2, e2 = this, i2, s2) {
          const o2 = this.strings;
          let r2 = false;
          if (void 0 === o2) t2 = Z(this, t2, e2, 0), r2 = !I(t2) || t2 !== this._$AH && t2 !== G, r2 && (this._$AH = t2);
          else {
            const s3 = t2;
            let n2, h2;
            for (t2 = o2[0], n2 = 0; n2 < o2.length - 1; n2++) h2 = Z(this, s3[i2 + n2], e2, n2), h2 === G && (h2 = this._$AH[n2]), r2 ||= !I(h2) || h2 !== this._$AH[n2], h2 === q ? t2 = q : t2 !== q && (t2 += (h2 ?? "") + o2[n2 + 1]), this._$AH[n2] = h2;
          }
          r2 && !s2 && this.j(t2);
        }
        j(t2) {
          t2 === q ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t2 ?? "");
        }
      };
      et = class extends tt {
        constructor() {
          super(...arguments), this.type = 3;
        }
        j(t2) {
          this.element[this.name] = t2 === q ? void 0 : t2;
        }
      };
      it = class extends tt {
        constructor() {
          super(...arguments), this.type = 4;
        }
        j(t2) {
          this.element.toggleAttribute(this.name, !!t2 && t2 !== q);
        }
      };
      st = class extends tt {
        constructor(t2, e2, i2, s2, o2) {
          super(t2, e2, i2, s2, o2), this.type = 5;
        }
        _$AI(t2, e2 = this) {
          if ((t2 = Z(this, t2, e2, 0) ?? q) === G) return;
          const i2 = this._$AH, s2 = t2 === q && i2 !== q || t2.capture !== i2.capture || t2.once !== i2.once || t2.passive !== i2.passive, o2 = t2 !== q && (i2 === q || s2);
          s2 && this.element.removeEventListener(this.name, this, i2), o2 && this.element.addEventListener(this.name, this, t2), this._$AH = t2;
        }
        handleEvent(t2) {
          "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t2) : this._$AH.handleEvent(t2);
        }
      };
      ot = class {
        constructor(t2, e2, i2) {
          this.element = t2, this.type = 6, this._$AN = void 0, this._$AM = e2, this.options = i2;
        }
        get _$AU() {
          return this._$AM._$AU;
        }
        _$AI(t2) {
          Z(this, t2);
        }
      };
      rt = { I: Q };
      nt = $.litHtmlPolyfillSupport;
      nt?.(Y, Q), ($.litHtmlVersions ??= []).push("3.3.0");
      ht = (t2, e2, i2) => {
        const s2 = i2?.renderBefore ?? e2;
        let o2 = s2._$litPart$;
        if (void 0 === o2) {
          const t3 = i2?.renderBefore ?? null;
          s2._$litPart$ = o2 = new Q(e2.insertBefore(E(), t3), t3, void 0, i2 ?? {});
        }
        return o2._$AI(t2), o2;
      };
      at = globalThis;
      lt = class extends k {
        constructor() {
          super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
        }
        createRenderRoot() {
          const t2 = super.createRenderRoot();
          return this.renderOptions.renderBefore ??= t2.firstChild, t2;
        }
        update(t2) {
          const e2 = this.render();
          this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t2), this._$Do = ht(e2, this.renderRoot, this.renderOptions);
        }
        connectedCallback() {
          super.connectedCallback(), this._$Do?.setConnected(true);
        }
        disconnectedCallback() {
          super.disconnectedCallback(), this._$Do?.setConnected(false);
        }
        render() {
          return G;
        }
      };
      lt._$litElement$ = true, lt.finalized = true, at.litElementHydrateSupport?.({ LitElement: lt });
      ct = at.litElementPolyfillSupport;
      ct?.({ LitElement: lt }), (at.litElementVersions ??= []).push("4.2.0");
      dt = { attribute: true, type: String, converter: x, reflect: false, hasChanged: w };
      ut = (t2 = dt, e2, i2) => {
        const { kind: s2, metadata: o2 } = i2;
        let r2 = globalThis.litPropertyMetadata.get(o2);
        if (void 0 === r2 && globalThis.litPropertyMetadata.set(o2, r2 = /* @__PURE__ */ new Map()), "setter" === s2 && ((t2 = Object.create(t2)).wrapped = true), r2.set(i2.name, t2), "accessor" === s2) {
          const { name: s3 } = i2;
          return { set(i3) {
            const o3 = e2.get.call(this);
            e2.set.call(this, i3), this.requestUpdate(s3, o3, t2);
          }, init(e3) {
            return void 0 !== e3 && this.C(s3, void 0, t2, e3), e3;
          } };
        }
        if ("setter" === s2) {
          const { name: s3 } = i2;
          return function(i3) {
            const o3 = this[s3];
            e2.call(this, i3), this.requestUpdate(s3, o3, t2);
          };
        }
        throw Error("Unsupported decorator location: " + s2);
      };
      bt = (t2, e2, i2) => (i2.configurable = true, i2.enumerable = true, i2);
      xt = "2.5.1";
      wt = "__vscodeElements_disableRegistryWarning__";
      yt = (t2, e2) => {
        e2 ? console.warn(`[VSCode Elements] ${t2}
%o`, e2) : console.warn(`${t2}
%o`, e2);
      };
      kt = class extends lt {
        get version() {
          return xt;
        }
        warn(t2) {
          yt(t2, this);
        }
      };
      $t = (t2) => (e2) => {
        if (!customElements.get(t2)) return void customElements.define(t2, e2);
        if (wt in window) return;
        const i2 = document.createElement(t2), s2 = i2?.version;
        let o2 = "";
        s2 ? s2 !== xt ? (o2 += "is already registered by a different version of VSCode Elements. ", o2 += `This version is "${xt}", while the other one is "${s2}".`) : o2 += `is already registered by the same version of VSCode Elements (${xt}).` : o2 += "is already registered by an unknown custom element handler class.", yt(`The custom element "${t2}" ${o2}
To suppress this warning, set window.${wt} to true`);
      };
      _t = n`
  :host([hidden]) {
    display: none;
  }

  :host([disabled]),
  :host(:disabled) {
    cursor: not-allowed;
    opacity: 0.4;
    pointer-events: none;
  }
`;
      Ct = [_t, n`
    :host {
      display: inline-block;
    }

    .root {
      background-color: var(--vscode-badge-background, #616161);
      border: 1px solid var(--vscode-contrastBorder, transparent);
      border-radius: 2px;
      box-sizing: border-box;
      color: var(--vscode-badge-foreground, #f8f8f8);
      display: block;
      font-family: var(--vscode-font-family, ${r(St())});
      font-size: 11px;
      font-weight: 400;
      line-height: 14px;
      min-width: 18px;
      padding: 2px 3px;
      text-align: center;
      white-space: nowrap;
    }

    :host([variant='counter']) .root {
      border-radius: 11px;
      line-height: 11px;
      min-height: 18px;
      min-width: 18px;
      padding: 3px 6px;
    }

    :host([variant='activity-bar-counter']) .root {
      background-color: var(--vscode-activityBarBadge-background, #0078d4);
      border-radius: 20px;
      color: var(--vscode-activityBarBadge-foreground, #ffffff);
      font-size: 9px;
      font-weight: 600;
      line-height: 16px;
      padding: 0 4px;
    }

    :host([variant='tab-header-counter']) .root {
      background-color: var(--vscode-activityBarBadge-background, #0078d4);
      border-radius: 10px;
      color: var(--vscode-activityBarBadge-foreground, #ffffff);
      line-height: 10px;
      min-height: 16px;
      min-width: 16px;
      padding: 3px 5px;
    }
  `];
      Bt = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      At = class extends kt {
        constructor() {
          super(...arguments), this.variant = "default";
        }
        render() {
          return U`<div class="root"><slot></slot></div>`;
        }
      };
      At.styles = Ct, Bt([pt({ reflect: true })], At.prototype, "variant", void 0), At = Bt([$t("vscode-badge")], At);
      Ot = 1;
      zt = 2;
      Et = 3;
      It = (t2) => (...e2) => ({ _$litDirective$: t2, values: e2 });
      jt = class {
        constructor(t2) {
        }
        get _$AU() {
          return this._$AM._$AU;
        }
        _$AT(t2, e2, i2) {
          this._$Ct = t2, this._$AM = e2, this._$Ci = i2;
        }
        _$AS(t2, e2) {
          return this.update(t2, e2);
        }
        update(t2, e2) {
          return this.render(...e2);
        }
      };
      Mt = It(class extends jt {
        constructor(t2) {
          if (super(t2), t2.type !== Ot || "class" !== t2.name || t2.strings?.length > 2) throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.");
        }
        render(t2) {
          return " " + Object.keys(t2).filter(((e2) => t2[e2])).join(" ") + " ";
        }
        update(t2, [e2]) {
          if (void 0 === this.st) {
            this.st = /* @__PURE__ */ new Set(), void 0 !== t2.strings && (this.nt = new Set(t2.strings.join(" ").split(/\s/).filter(((t3) => "" !== t3))));
            for (const t3 in e2) e2[t3] && !this.nt?.has(t3) && this.st.add(t3);
            return this.render(e2);
          }
          const i2 = t2.element.classList;
          for (const t3 of this.st) t3 in e2 || (i2.remove(t3), this.st.delete(t3));
          for (const t3 in e2) {
            const s2 = !!e2[t3];
            s2 === this.st.has(t3) || this.nt?.has(t3) || (s2 ? (i2.add(t3), this.st.add(t3)) : (i2.remove(t3), this.st.delete(t3)));
          }
          return G;
        }
      });
      Dt = (t2) => t2 ?? q;
      Ft = It(class extends jt {
        constructor(t2) {
          if (super(t2), this._prevProperties = {}, t2.type !== Et || "style" !== t2.name) throw new Error("The `stylePropertyMap` directive must be used in the `style` property");
        }
        update(t2, [e2]) {
          return Object.entries(e2).forEach((([e3, i2]) => {
            this._prevProperties[e3] !== i2 && (e3.startsWith("--") ? t2.element.style.setProperty(e3, i2) : t2.element.style[e3] = i2, this._prevProperties[e3] = i2);
          })), G;
        }
        render(t2) {
          return G;
        }
      });
      Pt = [_t, n`
    :host {
      color: var(--vscode-icon-foreground, #cccccc);
      display: inline-block;
    }

    .codicon[class*='codicon-'] {
      display: block;
    }

    .icon,
    .button {
      background-color: transparent;
      display: block;
      padding: 0;
    }

    .button {
      border-color: transparent;
      border-style: solid;
      border-width: 1px;
      border-radius: 5px;
      color: currentColor;
      cursor: pointer;
      padding: 2px;
    }

    .button:hover {
      background-color: var(
        --vscode-toolbar-hoverBackground,
        rgba(90, 93, 94, 0.31)
      );
    }

    .button:active {
      background-color: var(
        --vscode-toolbar-activeBackground,
        rgba(99, 102, 103, 0.31)
      );
    }

    .button:focus {
      outline: none;
    }

    .button:focus-visible {
      border-color: var(--vscode-focusBorder, #0078d4);
    }

    @keyframes icon-spin {
      100% {
        transform: rotate(360deg);
      }
    }

    .spin {
      animation-name: icon-spin;
      animation-timing-function: linear;
      animation-iteration-count: infinite;
    }
  `];
      Nt = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      Tt = Vt = class extends kt {
        constructor() {
          super(...arguments), this.label = "", this.name = "", this.size = 16, this.spin = false, this.spinDuration = 1.5, this.actionIcon = false, this._onButtonClick = (t2) => {
            this.dispatchEvent(new CustomEvent("vsc-click", { detail: { originalEvent: t2 } }));
          };
        }
        connectedCallback() {
          super.connectedCallback();
          const { href: t2, nonce: e2 } = this._getStylesheetConfig();
          Vt.stylesheetHref = t2, Vt.nonce = e2;
        }
        _getStylesheetConfig() {
          if ("undefined" == typeof document) return { nonce: void 0, href: void 0 };
          const t2 = document.getElementById("vscode-codicon-stylesheet"), e2 = t2?.getAttribute("href") || void 0, i2 = t2?.nonce || void 0;
          if (!t2) {
            let t3 = 'To use the Icon component, the codicons.css file must be included in the page with the id "vscode-codicon-stylesheet"! ';
            t3 += "See https://vscode-elements.github.io/components/icon/ for more details.", this.warn(t3);
          }
          return { nonce: i2, href: e2 };
        }
        render() {
          const { stylesheetHref: t2, nonce: e2 } = Vt, i2 = U`<span
      class=${Mt({ codicon: true, ["codicon-" + this.name]: true, spin: this.spin })}
      .style=${Ft({ animationDuration: String(this.spinDuration) + "s", fontSize: this.size + "px", height: this.size + "px", width: this.size + "px" })}
    ></span>`, s2 = this.actionIcon ? U` <button
          class="button"
          @click=${this._onButtonClick}
          aria-label=${this.label}
        >
          ${i2}
        </button>` : U` <span class="icon" aria-hidden="true" role="presentation"
          >${i2}</span
        >`;
          return U`
      <link
        rel="stylesheet"
        href=${Dt(t2)}
        nonce=${Dt(e2)}
      />
      ${s2}
    `;
        }
      };
      Tt.styles = Pt, Tt.stylesheetHref = "", Tt.nonce = "", Nt([pt()], Tt.prototype, "label", void 0), Nt([pt({ type: String })], Tt.prototype, "name", void 0), Nt([pt({ type: Number })], Tt.prototype, "size", void 0), Nt([pt({ type: Boolean, reflect: true })], Tt.prototype, "spin", void 0), Nt([pt({ type: Number, attribute: "spin-duration" })], Tt.prototype, "spinDuration", void 0), Nt([pt({ type: Boolean, reflect: true, attribute: "action-icon" })], Tt.prototype, "actionIcon", void 0), Tt = Vt = Nt([$t("vscode-icon")], Tt);
      Rt = [_t, n`
    :host {
      cursor: pointer;
      display: inline-block;
      width: auto;
    }

    :host([block]) {
      display: block;
      width: 100%;
    }

    .base {
      align-items: center;
      background-color: var(--vscode-button-background, #0078d4);
      border-bottom-left-radius: var(--vsc-border-left-radius, 4px);
      border-bottom-right-radius: var(--vsc-border-right-radius, 4px);
      border-bottom-width: 1px;
      border-color: var(--vscode-button-border, transparent);
      border-left-width: var(--vsc-border-left-width, 1px);
      border-right-width: var(--vsc-border-right-width, 1px);
      border-style: solid;
      border-top-left-radius: var(--vsc-border-left-radius, 4px);
      border-top-right-radius: var(--vsc-border-right-radius, 4px);
      border-top-width: 1px;
      box-sizing: border-box;
      color: var(--vscode-button-foreground, #ffffff);
      display: flex;
      font-family: var(--vscode-font-family, ${r(St())});
      font-size: var(--vscode-font-size, 13px);
      font-weight: var(--vscode-font-weight, normal);
      height: 100%;
      justify-content: center;
      line-height: 22px;
      overflow: hidden;
      padding: 1px calc(13px + var(--vsc-base-additional-right-padding, 0px))
        1px 13px;
      position: relative;
      user-select: none;
      white-space: nowrap;
      width: 100%;
    }

    :host([block]) .base {
      min-height: 28px;
      text-align: center;
      width: 100%;
    }

    .base:after {
      background-color: var(
        --vscode-button-separator,
        rgba(255, 255, 255, 0.4)
      );
      content: var(--vsc-base-after-content);
      display: var(--vsc-divider-display, none);
      position: absolute;
      right: 0;
      top: 4px;
      bottom: 4px;
      width: 1px;
    }

    :host([secondary]) .base:after {
      background-color: var(--vscode-button-secondaryForeground, #cccccc);
      opacity: 0.4;
    }

    :host([secondary]) .base {
      color: var(--vscode-button-secondaryForeground, #cccccc);
      background-color: var(--vscode-button-secondaryBackground, #313131);
      border-color: var(
        --vscode-button-border,
        var(--vscode-button-secondaryBackground, rgba(255, 255, 255, 0.07))
      );
    }

    :host([disabled]) {
      cursor: default;
      opacity: 0.4;
      pointer-events: none;
    }

    :host(:hover) .base {
      background-color: var(--vscode-button-hoverBackground, #026ec1);
    }

    :host([disabled]:hover) .base {
      background-color: var(--vscode-button-background, #0078d4);
    }

    :host([secondary]:hover) .base {
      background-color: var(--vscode-button-secondaryHoverBackground, #3c3c3c);
    }

    :host([secondary][disabled]:hover) .base {
      background-color: var(--vscode-button-secondaryBackground, #313131);
    }

    :host(:focus),
    :host(:active) {
      outline: none;
    }

    :host(:focus) .base {
      background-color: var(--vscode-button-hoverBackground, #026ec1);
      outline: 1px solid var(--vscode-focusBorder, #0078d4);
      outline-offset: 2px;
    }

    :host([disabled]:focus) .base {
      background-color: var(--vscode-button-background, #0078d4);
      outline: 0;
    }

    :host([secondary]:focus) .base {
      background-color: var(--vscode-button-secondaryHoverBackground, #3c3c3c);
    }

    :host([secondary][disabled]:focus) .base {
      background-color: var(--vscode-button-secondaryBackground, #313131);
    }

    ::slotted(*) {
      display: inline-block;
      margin-left: 4px;
      margin-right: 4px;
    }

    ::slotted(*:first-child) {
      margin-left: 0;
    }

    ::slotted(*:last-child) {
      margin-right: 0;
    }

    ::slotted(vscode-icon) {
      color: inherit;
    }

    .content {
      display: flex;
      position: relative;
      width: 100%;
      height: 100%;
      padding: 1px 13px;
    }

    :host(:empty) .base,
    .base.icon-only {
      min-height: 24px;
      min-width: 26px;
      padding: 1px 4px;
    }

    slot {
      align-items: center;
      display: flex;
      height: 100%;
    }

    .has-content-before slot[name='content-before'] {
      margin-right: 4px;
    }

    .has-content-after slot[name='content-after'] {
      margin-left: 4px;
    }

    .icon,
    .icon-after {
      color: inherit;
      display: block;
    }

    :host(:not(:empty)) .icon {
      margin-right: 3px;
    }

    :host(:not(:empty)) .icon-after,
    :host([icon]) .icon-after {
      margin-left: 3px;
    }
  `];
      Lt = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      Ut = class extends kt {
        get form() {
          return this._internals.form;
        }
        constructor() {
          super(), this.autofocus = false, this.tabIndex = 0, this.secondary = false, this.block = false, this.role = "button", this.disabled = false, this.icon = "", this.iconSpin = false, this.iconAfter = "", this.iconAfterSpin = false, this.focused = false, this.name = void 0, this.iconOnly = false, this.type = "button", this.value = "", this._prevTabindex = 0, this._hasContentBefore = false, this._hasContentAfter = false, this._handleFocus = () => {
            this.focused = true;
          }, this._handleBlur = () => {
            this.focused = false;
          }, this.addEventListener("keydown", this._handleKeyDown.bind(this)), this.addEventListener("click", this._handleClick.bind(this)), this._internals = this.attachInternals();
        }
        connectedCallback() {
          super.connectedCallback(), this.autofocus && (this.tabIndex < 0 && (this.tabIndex = 0), this.updateComplete.then((() => {
            this.focus(), this.requestUpdate();
          }))), this.addEventListener("focus", this._handleFocus), this.addEventListener("blur", this._handleBlur);
        }
        disconnectedCallback() {
          super.disconnectedCallback(), this.removeEventListener("focus", this._handleFocus), this.removeEventListener("blur", this._handleBlur);
        }
        update(t2) {
          super.update(t2), t2.has("value") && this._internals.setFormValue(this.value), t2.has("disabled") && (this.disabled ? (this._prevTabindex = this.tabIndex, this.tabIndex = -1) : this.tabIndex = this._prevTabindex);
        }
        _executeAction() {
          "submit" === this.type && this._internals.form && this._internals.form.requestSubmit(), "reset" === this.type && this._internals.form && this._internals.form.reset();
        }
        _handleKeyDown(t2) {
          if (("Enter" === t2.key || " " === t2.key) && !this.hasAttribute("disabled")) {
            const t3 = new MouseEvent("click", { bubbles: true, cancelable: true });
            t3.synthetic = true, this.dispatchEvent(t3), this._executeAction();
          }
        }
        _handleClick(t2) {
          t2.synthetic || this.hasAttribute("disabled") || this._executeAction();
        }
        _handleSlotChange(t2) {
          const e2 = t2.target;
          "content-before" === e2.name && (this._hasContentBefore = e2.assignedElements().length > 0), "content-after" === e2.name && (this._hasContentAfter = e2.assignedElements().length > 0);
        }
        render() {
          const t2 = "" !== this.icon, e2 = "" !== this.iconAfter, i2 = { base: true, "icon-only": this.iconOnly, "has-content-before": this._hasContentBefore, "has-content-after": this._hasContentAfter }, s2 = t2 ? U`<vscode-icon
          name=${this.icon}
          ?spin=${this.iconSpin}
          spin-duration=${Dt(this.iconSpinDuration)}
          class="icon"
        ></vscode-icon>` : q, o2 = e2 ? U`<vscode-icon
          name=${this.iconAfter}
          ?spin=${this.iconAfterSpin}
          spin-duration=${Dt(this.iconAfterSpinDuration)}
          class="icon-after"
        ></vscode-icon>` : q;
          return U`
      <div
        class=${Mt(i2)}
        part="base"
        @slotchange=${this._handleSlotChange}
      >
        <slot name="content-before"></slot>
        ${s2}
        <slot></slot>
        ${o2}
        <slot name="content-after"></slot>
      </div>
    `;
        }
      };
      Ut.styles = Rt, Ut.formAssociated = true, Lt([pt({ type: Boolean, reflect: true })], Ut.prototype, "autofocus", void 0), Lt([pt({ type: Number, reflect: true })], Ut.prototype, "tabIndex", void 0), Lt([pt({ type: Boolean, reflect: true })], Ut.prototype, "secondary", void 0), Lt([pt({ type: Boolean, reflect: true })], Ut.prototype, "block", void 0), Lt([pt({ reflect: true })], Ut.prototype, "role", void 0), Lt([pt({ type: Boolean, reflect: true })], Ut.prototype, "disabled", void 0), Lt([pt()], Ut.prototype, "icon", void 0), Lt([pt({ type: Boolean, reflect: true, attribute: "icon-spin" })], Ut.prototype, "iconSpin", void 0), Lt([pt({ type: Number, reflect: true, attribute: "icon-spin-duration" })], Ut.prototype, "iconSpinDuration", void 0), Lt([pt({ attribute: "icon-after" })], Ut.prototype, "iconAfter", void 0), Lt([pt({ type: Boolean, reflect: true, attribute: "icon-after-spin" })], Ut.prototype, "iconAfterSpin", void 0), Lt([pt({ type: Number, reflect: true, attribute: "icon-after-spin-duration" })], Ut.prototype, "iconAfterSpinDuration", void 0), Lt([pt({ type: Boolean, reflect: true })], Ut.prototype, "focused", void 0), Lt([pt({ type: String, reflect: true })], Ut.prototype, "name", void 0), Lt([pt({ type: Boolean, reflect: true, attribute: "icon-only" })], Ut.prototype, "iconOnly", void 0), Lt([pt({ reflect: true })], Ut.prototype, "type", void 0), Lt([pt()], Ut.prototype, "value", void 0), Lt([vt()], Ut.prototype, "_hasContentBefore", void 0), Lt([vt()], Ut.prototype, "_hasContentAfter", void 0), Ut = Lt([$t("vscode-button")], Ut);
      Ht = [_t, n`
    :host {
      display: inline-block;
    }

    .root {
      align-items: stretch;
      display: flex;
      width: 100%;
    }

    ::slotted(vscode-button:not(:first-child)) {
      --vsc-border-left-width: 0;
      --vsc-border-left-radius: 0;
      --vsc-border-left-width: 0;
    }

    ::slotted(vscode-button:not(:last-child)) {
      --vsc-divider-display: block;
      --vsc-base-additional-right-padding: 1px;
      --vsc-base-after-content: '';
      --vsc-border-right-width: 0;
      --vsc-border-right-radius: 0;
      --vsc-border-right-width: 0;
    }

    ::slotted(vscode-button:focus) {
      z-index: 1;
    }

    ::slotted(vscode-button:not(:empty)) {
      width: 100%;
    }
  `];
      Gt = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      qt = class extends kt {
        render() {
          return U`<div class="root"><slot></slot></div>`;
        }
      };
      qt.styles = Ht, qt = Gt([$t("vscode-button-group")], qt);
      Wt = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      Kt = class extends kt {
        constructor() {
          super(), this.focused = false, this._prevTabindex = 0, this._handleFocus = () => {
            this.focused = true;
          }, this._handleBlur = () => {
            this.focused = false;
          };
        }
        connectedCallback() {
          super.connectedCallback(), this.addEventListener("focus", this._handleFocus), this.addEventListener("blur", this._handleBlur);
        }
        disconnectedCallback() {
          super.disconnectedCallback(), this.removeEventListener("focus", this._handleFocus), this.removeEventListener("blur", this._handleBlur);
        }
        attributeChangedCallback(t2, e2, i2) {
          super.attributeChangedCallback(t2, e2, i2), "disabled" === t2 && this.hasAttribute("disabled") ? (this._prevTabindex = this.tabIndex, this.tabIndex = -1) : "disabled" !== t2 || this.hasAttribute("disabled") || (this.tabIndex = this._prevTabindex);
        }
      };
      Wt([pt({ type: Boolean, reflect: true })], Kt.prototype, "focused", void 0);
      Xt = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      Jt = (t2) => {
        class e2 extends t2 {
          constructor() {
            super(...arguments), this._label = "", this._slottedText = "";
          }
          set label(t3) {
            this._label = t3, "" === this._slottedText && this.setAttribute("aria-label", t3);
          }
          get label() {
            return this._label;
          }
          _handleSlotChange() {
            this._slottedText = this.textContent ? this.textContent.trim() : "", "" !== this._slottedText && this.setAttribute("aria-label", this._slottedText);
          }
          _renderLabelAttribute() {
            return "" === this._slottedText ? U`<span class="label-attr">${this._label}</span>` : U`${q}`;
          }
        }
        return Xt([pt()], e2.prototype, "label", null), e2;
      };
      Yt = [n`
    :host {
      display: inline-block;
    }

    :host(:focus) {
      outline: none;
    }

    :host([disabled]) {
      opacity: 0.4;
    }

    .wrapper {
      color: var(--vscode-foreground, #cccccc);
      cursor: pointer;
      display: block;
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      font-weight: var(--vscode-font-weight, normal);
      line-height: 18px;
      margin-bottom: 4px;
      margin-top: 4px;
      min-height: 18px;
      position: relative;
      user-select: none;
    }

    :host([disabled]) .wrapper {
      cursor: default;
    }

    input {
      clip: rect(1px, 1px, 1px, 1px);
      height: 1px;
      left: 9px;
      margin: 0;
      overflow: hidden;
      position: absolute;
      top: 17px;
      white-space: nowrap;
      width: 1px;
    }

    .icon {
      align-items: center;
      background-color: var(--vscode-settings-checkboxBackground, #313131);
      background-size: 16px;
      border: 1px solid var(--vscode-settings-checkboxBorder, #3c3c3c);
      box-sizing: border-box;
      color: var(--vscode-settings-checkboxForeground, #cccccc);
      display: flex;
      height: 18px;
      justify-content: center;
      left: 0;
      margin-left: 0;
      margin-right: 9px;
      padding: 0;
      pointer-events: none;
      position: absolute;
      top: 0;
      width: 18px;
    }

    .icon.before-empty-label {
      margin-right: 0;
    }

    .label {
      cursor: pointer;
      display: block;
      min-height: 18px;
      min-width: 18px;
    }

    .label-inner {
      display: block;
      opacity: 0.9;
      padding-left: 27px;
    }

    .label-inner.empty {
      padding-left: 0;
    }

    :host([disabled]) .label {
      cursor: default;
    }
  `];
      Zt = [_t, Yt, n`
    :host(:invalid) .icon,
    :host([invalid]) .icon {
      background-color: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      border-color: var(--vscode-inputValidation-errorBorder, #be1100);
    }

    .icon {
      border-radius: 3px;
    }

    .indeterminate-icon {
      background-color: currentColor;
      position: absolute;
      height: 1px;
      width: 12px;
    }

    :host(:focus):host(:not([disabled])) .icon {
      outline: 1px solid var(--vscode-focusBorder, #0078d4);
      outline-offset: -1px;
    }

    /* Toggle appearance */
    :host([toggle]) .icon {
      /* Track */
      width: 36px;
      height: 20px;
      border-radius: 999px;
      background-color: var(--vscode-button-secondaryBackground, #313131);
      border-color: var(--vscode-button-border, transparent);
      justify-content: flex-start;
      position: absolute;
    }

    :host(:focus):host([toggle]):host(:not([disabled])) .icon {
      outline-offset: 2px;
    }

    /* Reserve space for the wider toggle track so text doesn't overlap */
    :host([toggle]) .label-inner {
      padding-left: 45px; /* 36px track + 9px spacing */
    }

    :host([toggle]) .label {
      min-height: 20px;
    }

    :host([toggle]) .wrapper {
      min-height: 20px;
      line-height: 20px;
    }

    :host([toggle]) .thumb {
      /* Thumb */
      box-sizing: border-box;
      display: block;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: var(--vscode-button-secondaryForeground, #cccccc);
      margin-left: 1px;
      transition: transform 120ms ease-in-out;
    }

    :host([toggle][checked]) .icon {
      background-color: var(--vscode-button-background, #04395e);
      border-color: var(--vscode-button-border, transparent);
    }

    :host([toggle][checked]) .thumb {
      transform: translateX(16px);
      background-color: var(--vscode-button-foreground, #ffffff);
    }

    :host([toggle]):host(:invalid) .icon {
      background-color: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      border-color: var(--vscode-inputValidation-errorBorder, #be1100);
    }

    :host([toggle]):host(:invalid) .thumb {
      background-color: var(--vscode-inputValidation-errorBorder, #be1100);
    }

    :host([toggle]) .check-icon,
    :host([toggle]) .indeterminate-icon {
      display: none;
    }

    :host([toggle]:focus):host(:not([disabled])) .icon {
      outline: 1px solid var(--vscode-focusBorder, #0078d4);
      outline-offset: -1px;
    }
  `];
      Qt = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      te = class extends Jt(Kt) {
        set checked(t2) {
          this._checked = t2, this._manageRequired(), this.requestUpdate();
        }
        get checked() {
          return this._checked;
        }
        set required(t2) {
          this._required = t2, this._manageRequired(), this.requestUpdate();
        }
        get required() {
          return this._required;
        }
        get form() {
          return this._internals.form;
        }
        get validity() {
          return this._internals.validity;
        }
        get validationMessage() {
          return this._internals.validationMessage;
        }
        get willValidate() {
          return this._internals.willValidate;
        }
        checkValidity() {
          return this._internals.checkValidity();
        }
        reportValidity() {
          return this._internals.reportValidity();
        }
        constructor() {
          super(), this.autofocus = false, this._checked = false, this.defaultChecked = false, this.invalid = false, this.name = void 0, this.toggle = false, this.value = "", this.disabled = false, this.indeterminate = false, this._required = false, this.type = "checkbox", this._handleClick = (t2) => {
            t2.preventDefault(), this.disabled || this._toggleState();
          }, this._handleKeyDown = (t2) => {
            this.disabled || "Enter" !== t2.key && " " !== t2.key || (t2.preventDefault(), " " === t2.key && this._toggleState(), "Enter" === t2.key && this._internals.form?.requestSubmit());
          }, this._internals = this.attachInternals();
        }
        connectedCallback() {
          super.connectedCallback(), this.addEventListener("keydown", this._handleKeyDown), this.updateComplete.then((() => {
            this._manageRequired(), this._setActualFormValue();
          }));
        }
        disconnectedCallback() {
          this.removeEventListener("keydown", this._handleKeyDown);
        }
        formResetCallback() {
          this.checked = this.defaultChecked;
        }
        formStateRestoreCallback(t2, e2) {
          t2 && (this.checked = true);
        }
        _setActualFormValue() {
          let t2 = "";
          t2 = this.checked ? this.value ? this.value : "on" : null, this._internals.setFormValue(t2);
        }
        _toggleState() {
          this.checked = !this.checked, this.indeterminate = false, this._setActualFormValue(), this._manageRequired(), this.dispatchEvent(new Event("change", { bubbles: true }));
        }
        _manageRequired() {
          !this.checked && this.required ? this._internals.setValidity({ valueMissing: true }, "Please check this box if you want to proceed.", this._inputEl ?? void 0) : this._internals.setValidity({});
        }
        render() {
          const t2 = Mt({ icon: true, checked: this.checked, indeterminate: this.indeterminate }), e2 = Mt({ "label-inner": true }), i2 = U`<svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      class="check-icon"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.764.646z"
      />
    </svg>`, s2 = this.checked && !this.indeterminate ? i2 : q, o2 = this.indeterminate ? U`<span class="indeterminate-icon"></span>` : q, r2 = this.toggle ? U`<span class="thumb"></span>` : U`${o2}${s2}`;
          return U`
      <div class="wrapper">
        <input
          ?autofocus=${this.autofocus}
          id="input"
          class="checkbox"
          type="checkbox"
          ?checked=${this.checked}
          role=${Dt(this.toggle ? "switch" : void 0)}
          aria-checked=${Dt(this.toggle ? this.checked ? "true" : "false" : void 0)}
          value=${this.value}
        />
        <div class=${t2}>${r2}</div>
        <label for="input" class="label" @click=${this._handleClick}>
          <span class=${e2}>
            ${this._renderLabelAttribute()}
            <slot @slotchange=${this._handleSlotChange}></slot>
          </span>
        </label>
      </div>
    `;
        }
      };
      te.styles = Zt, te.formAssociated = true, te.shadowRootOptions = { ...lt.shadowRootOptions, delegatesFocus: true }, Qt([pt({ type: Boolean, reflect: true })], te.prototype, "autofocus", void 0), Qt([pt({ type: Boolean, reflect: true })], te.prototype, "checked", null), Qt([pt({ type: Boolean, reflect: true, attribute: "default-checked" })], te.prototype, "defaultChecked", void 0), Qt([pt({ type: Boolean, reflect: true })], te.prototype, "invalid", void 0), Qt([pt({ reflect: true })], te.prototype, "name", void 0), Qt([pt({ type: Boolean, reflect: true })], te.prototype, "toggle", void 0), Qt([pt()], te.prototype, "value", void 0), Qt([pt({ type: Boolean, reflect: true })], te.prototype, "disabled", void 0), Qt([pt({ type: Boolean, reflect: true })], te.prototype, "indeterminate", void 0), Qt([pt({ type: Boolean, reflect: true })], te.prototype, "required", null), Qt([pt()], te.prototype, "type", void 0), Qt([ft("#input")], te.prototype, "_inputEl", void 0), te = Qt([$t("vscode-checkbox")], te);
      ee = [_t, n`
    :host {
      display: block;
    }

    .wrapper {
      display: flex;
      flex-wrap: wrap;
    }

    :host([variant='vertical']) .wrapper {
      display: block;
    }

    ::slotted(vscode-checkbox) {
      margin-right: 20px;
    }

    ::slotted(vscode-checkbox:last-child) {
      margin-right: 0;
    }

    :host([variant='vertical']) ::slotted(vscode-checkbox) {
      display: block;
      margin-bottom: 15px;
    }

    :host([variant='vertical']) ::slotted(vscode-checkbox:last-child) {
      margin-bottom: 0;
    }
  `];
      ie = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      se = class extends kt {
        constructor() {
          super(...arguments), this.role = "group", this.variant = "horizontal";
        }
        render() {
          return U`
      <div class="wrapper">
        <slot></slot>
      </div>
    `;
        }
      };
      se.styles = ee, ie([pt({ reflect: true })], se.prototype, "role", void 0), ie([pt({ reflect: true })], se.prototype, "variant", void 0), se = ie([$t("vscode-checkbox-group")], se);
      oe = [_t, n`
    :host {
      display: block;
    }

    .collapsible {
      background-color: var(--vscode-sideBar-background, #181818);
    }

    .collapsible-header {
      align-items: center;
      background-color: var(--vscode-sideBarSectionHeader-background, #181818);
      cursor: pointer;
      display: flex;
      height: 22px;
      line-height: 22px;
      user-select: none;
    }

    .collapsible-header:focus {
      opacity: 1;
      outline-offset: -1px;
      outline-style: solid;
      outline-width: 1px;
      outline-color: var(--vscode-focusBorder, #0078d4);
    }

    .title {
      color: var(--vscode-sideBarTitle-foreground, #cccccc);
      display: block;
      font-family: var(--vscode-font-family, sans-serif);
      font-size: 11px;
      font-weight: 700;
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .title .description {
      font-weight: 400;
      margin-left: 10px;
      text-transform: none;
      opacity: 0.6;
    }

    .header-icon {
      color: var(--vscode-icon-foreground, #cccccc);
      display: block;
      flex-shrink: 0;
      margin: 0 3px;
    }

    .collapsible.open .header-icon {
      transform: rotate(90deg);
    }

    .header-slots {
      align-items: center;
      display: flex;
      height: 22px;
      margin-left: auto;
      margin-right: 4px;
    }

    .actions {
      display: none;
    }

    .collapsible.open .actions.always-visible,
    .collapsible.open:hover .actions {
      display: block;
    }

    .header-slots slot {
      display: flex;
      max-height: 22px;
      overflow: hidden;
    }

    .header-slots slot::slotted(div) {
      align-items: center;
      display: flex;
    }

    .collapsible-body {
      display: none;
      overflow: hidden;
    }

    .collapsible.open .collapsible-body {
      display: block;
    }
  `];
      re = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      ne = class extends kt {
        constructor() {
          super(...arguments), this.alwaysShowHeaderActions = false, this.title = "", this.heading = "", this.description = "", this.open = false;
        }
        _emitToggleEvent() {
          this.dispatchEvent(new CustomEvent("vsc-collapsible-toggle", { detail: { open: this.open } }));
        }
        _onHeaderClick() {
          this.open = !this.open, this._emitToggleEvent();
        }
        _onHeaderKeyDown(t2) {
          "Enter" === t2.key && (this.open = !this.open, this._emitToggleEvent());
        }
        _onHeaderSlotClick(t2) {
          t2.stopPropagation();
        }
        render() {
          const t2 = { collapsible: true, open: this.open }, e2 = { actions: true, "always-visible": this.alwaysShowHeaderActions }, i2 = this.heading ? this.heading : this.title, s2 = U`<svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      class="header-icon"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M10.072 8.024L5.715 3.667l.618-.62L11 7.716v.618L6.333 13l-.618-.619 4.357-4.357z"
      />
    </svg>`, o2 = this.description ? U`<span class="description">${this.description}</span>` : q;
          return U`
      <div class=${Mt(t2)}>
        <div
          class="collapsible-header"
          tabindex="0"
          @click=${this._onHeaderClick}
          @keydown=${this._onHeaderKeyDown}
        >
          ${s2}
          <h3 class="title">${i2}${o2}</h3>
          <div class="header-slots">
            <div class=${Mt(e2)}>
              <slot name="actions" @click=${this._onHeaderSlotClick}></slot>
            </div>
            <div class="decorations">
              <slot name="decorations" @click=${this._onHeaderSlotClick}></slot>
            </div>
          </div>
        </div>
        <div class="collapsible-body" part="body">
          <slot></slot>
        </div>
      </div>
    `;
        }
      };
      ne.styles = oe, re([pt({ type: Boolean, reflect: true, attribute: "always-show-header-actions" })], ne.prototype, "alwaysShowHeaderActions", void 0), re([pt({ type: String })], ne.prototype, "title", void 0), re([pt()], ne.prototype, "heading", void 0), re([pt()], ne.prototype, "description", void 0), re([pt({ type: Boolean, reflect: true })], ne.prototype, "open", void 0), ne = re([$t("vscode-collapsible")], ne);
      he = [_t, n`
    :host {
      display: block;
      outline: none;
      position: relative;
    }

    .context-menu-item {
      background-color: var(--vscode-menu-background, #1f1f1f);
      color: var(--vscode-menu-foreground, #cccccc);
      display: flex;
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      font-weight: var(--vscode-font-weight, normal);
      line-height: 1.4em;
      user-select: none;
      white-space: nowrap;
    }

    .ruler {
      border-bottom: 1px solid var(--vscode-menu-separatorBackground, #454545);
      display: block;
      margin: 0 0 4px;
      padding-top: 4px;
      width: 100%;
    }

    .context-menu-item a {
      align-items: center;
      border-color: transparent;
      border-radius: 3px;
      border-style: solid;
      border-width: 1px;
      box-sizing: border-box;
      color: var(--vscode-menu-foreground, #cccccc);
      cursor: pointer;
      display: flex;
      flex: 1 1 auto;
      height: 2em;
      margin-left: 4px;
      margin-right: 4px;
      outline: none;
      position: relative;
      text-decoration: inherit;
    }

    :host([selected]) .context-menu-item a {
      background-color: var(--vscode-menu-selectionBackground, #0078d4);
      border-color: var(--vscode-menu-selectionBorder, transparent);
      color: var(--vscode-menu-selectionForeground, #ffffff);
    }

    .label {
      background: none;
      display: flex;
      flex: 1 1 auto;
      font-size: 12px;
      line-height: 1;
      padding: 0 22px;
      text-decoration: none;
    }

    .keybinding {
      display: block;
      flex: 2 1 auto;
      line-height: 1;
      padding: 0 22px;
      text-align: right;
    }
  `];
      ae = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      le = class extends kt {
        constructor() {
          super(...arguments), this.label = "", this.keybinding = "", this.value = "", this.separator = false, this.tabindex = 0;
        }
        onItemClick() {
          this.dispatchEvent(new CustomEvent("vsc-click", { detail: { label: this.label, keybinding: this.keybinding, value: this.value || this.label, separator: this.separator, tabindex: this.tabindex }, bubbles: true, composed: true }));
        }
        render() {
          return U`
      ${this.separator ? U`
            <div class="context-menu-item separator">
              <span class="ruler"></span>
            </div>
          ` : U`
            <div class="context-menu-item">
              <a @click=${this.onItemClick}>
                ${this.label ? U`<span class="label">${this.label}</span>` : q}
                ${this.keybinding ? U`<span class="keybinding">${this.keybinding}</span>` : q}
              </a>
            </div>
          `}
    `;
        }
      };
      le.styles = he, ae([pt({ type: String })], le.prototype, "label", void 0), ae([pt({ type: String })], le.prototype, "keybinding", void 0), ae([pt({ type: String })], le.prototype, "value", void 0), ae([pt({ type: Boolean, reflect: true })], le.prototype, "separator", void 0), ae([pt({ type: Number })], le.prototype, "tabindex", void 0), le = ae([$t("vscode-context-menu-item")], le);
      ce = [_t, n`
    :host {
      display: block;
      position: relative;
    }

    .context-menu {
      background-color: var(--vscode-menu-background, #1f1f1f);
      border-color: var(--vscode-menu-border, #454545);
      border-radius: 5px;
      border-style: solid;
      border-width: 1px;
      box-shadow: 0 2px 8px var(--vscode-widget-shadow, rgba(0, 0, 0, 0.36));
      color: var(--vscode-menu-foreground, #cccccc);
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      font-weight: var(--vscode-font-weight, normal);
      line-height: 1.4em;
      padding: 4px 0;
      white-space: nowrap;
    }

    .context-menu:focus {
      outline: 0;
    }
  `];
      de = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      ue = class extends kt {
        set data(t2) {
          this._data = t2;
          const e2 = [];
          t2.forEach(((t3, i2) => {
            t3.separator || e2.push(i2);
          })), this._clickableItemIndexes = e2;
        }
        get data() {
          return this._data;
        }
        set show(t2) {
          this._show = t2, this._selectedClickableItemIndex = -1, t2 && this.updateComplete.then((() => {
            this._wrapperEl && this._wrapperEl.focus(), requestAnimationFrame((() => {
              document.addEventListener("click", this._onClickOutsideBound, { once: true });
            }));
          }));
        }
        get show() {
          return this._show;
        }
        constructor() {
          super(), this.preventClose = false, this.tabIndex = 0, this._selectedClickableItemIndex = -1, this._show = false, this._data = [], this._clickableItemIndexes = [], this._onClickOutsideBound = this._onClickOutside.bind(this), this.addEventListener("keydown", this._onKeyDown);
        }
        _onClickOutside(t2) {
          t2.composedPath().includes(this) || (this.show = false);
        }
        _onKeyDown(t2) {
          const { key: e2 } = t2;
          switch ("ArrowUp" !== e2 && "ArrowDown" !== e2 && "Escape" !== e2 && "Enter" !== e2 || t2.preventDefault(), e2) {
            case "ArrowUp":
              this._handleArrowUp();
              break;
            case "ArrowDown":
              this._handleArrowDown();
              break;
            case "Escape":
              this._handleEscape();
              break;
            case "Enter":
              this._handleEnter();
          }
        }
        _handleArrowUp() {
          0 === this._selectedClickableItemIndex ? this._selectedClickableItemIndex = this._clickableItemIndexes.length - 1 : this._selectedClickableItemIndex -= 1;
        }
        _handleArrowDown() {
          this._selectedClickableItemIndex + 1 < this._clickableItemIndexes.length ? this._selectedClickableItemIndex += 1 : this._selectedClickableItemIndex = 0;
        }
        _handleEscape() {
          this.show = false, document.removeEventListener("click", this._onClickOutsideBound);
        }
        _dispatchSelectEvent(t2) {
          const { keybinding: e2, label: i2, value: s2, separator: o2, tabindex: r2 } = t2;
          this.dispatchEvent(new CustomEvent("vsc-context-menu-select", { detail: { keybinding: e2, label: i2, separator: o2, tabindex: r2, value: s2 } }));
        }
        _handleEnter() {
          if (-1 === this._selectedClickableItemIndex) return;
          const t2 = this._clickableItemIndexes[this._selectedClickableItemIndex], e2 = this._wrapperEl.querySelectorAll("vscode-context-menu-item")[t2];
          this._dispatchSelectEvent(e2), this.preventClose || (this.show = false, document.removeEventListener("click", this._onClickOutsideBound));
        }
        _onItemClick(t2) {
          const e2 = t2.currentTarget;
          this._dispatchSelectEvent(e2), this.preventClose || (this.show = false);
        }
        _onItemMouseOver(t2) {
          const e2 = t2.target, i2 = e2.dataset.index ? +e2.dataset.index : -1, s2 = this._clickableItemIndexes.findIndex(((t3) => t3 === i2));
          -1 !== s2 && (this._selectedClickableItemIndex = s2);
        }
        _onItemMouseOut() {
          this._selectedClickableItemIndex = -1;
        }
        render() {
          if (!this._show) return U`${q}`;
          const t2 = this._clickableItemIndexes[this._selectedClickableItemIndex];
          return U`
      <div class="context-menu" tabindex="0">
        ${this.data ? this.data.map((({ label: e2 = "", keybinding: i2 = "", value: s2 = "", separator: o2 = false, tabindex: r2 = 0 }, n2) => U`
                <vscode-context-menu-item
                  label=${e2}
                  keybinding=${i2}
                  value=${s2}
                  ?separator=${o2}
                  ?selected=${n2 === t2}
                  tabindex=${r2}
                  @vsc-click=${this._onItemClick}
                  @mouseover=${this._onItemMouseOver}
                  @mouseout=${this._onItemMouseOut}
                  data-index=${n2}
                ></vscode-context-menu-item>
              `)) : U`<slot></slot>`}
      </div>
    `;
        }
      };
      ue.styles = ce, de([pt({ type: Array, attribute: false })], ue.prototype, "data", null), de([pt({ type: Boolean, reflect: true, attribute: "prevent-close" })], ue.prototype, "preventClose", void 0), de([pt({ type: Boolean, reflect: true })], ue.prototype, "show", null), de([pt({ type: Number, reflect: true })], ue.prototype, "tabIndex", void 0), de([vt()], ue.prototype, "_selectedClickableItemIndex", void 0), de([vt()], ue.prototype, "_show", void 0), de([ft(".context-menu")], ue.prototype, "_wrapperEl", void 0), ue = de([$t("vscode-context-menu")], ue);
      pe = [_t, n`
    :host {
      display: block;
      margin-bottom: 10px;
      margin-top: 10px;
    }

    div {
      background-color: var(--vscode-foreground, #cccccc);
      height: 1px;
      opacity: 0.4;
    }
  `];
      ve = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      be = class extends kt {
        constructor() {
          super(...arguments), this.role = "separator";
        }
        render() {
          return U`<div></div>`;
        }
      };
      be.styles = pe, ve([pt({ reflect: true })], be.prototype, "role", void 0), be = ve([$t("vscode-divider")], be);
      fe = [_t, n`
    :host {
      display: block;
      max-width: 727px;
    }
  `];
      me = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      !(function(t2) {
        t2.HORIZONTAL = "horizontal", t2.VERTICAL = "vertical";
      })(ge || (ge = {}));
      xe = class extends kt {
        constructor() {
          super(...arguments), this.breakpoint = 490, this._responsive = false, this._firstUpdateComplete = false, this._resizeObserverCallbackBound = this._resizeObserverCallback.bind(this);
        }
        set responsive(t2) {
          this._responsive = t2, this._firstUpdateComplete && (t2 ? this._activateResponsiveLayout() : this._deactivateResizeObserver());
        }
        get responsive() {
          return this._responsive;
        }
        _toggleCompactLayout(t2) {
          this._assignedFormGroups.forEach(((e2) => {
            e2.dataset.originalVariant || (e2.dataset.originalVariant = e2.variant);
            const i2 = e2.dataset.originalVariant;
            t2 === ge.VERTICAL && "horizontal" === i2 ? e2.variant = "vertical" : e2.variant = i2;
            e2.querySelectorAll("vscode-checkbox-group, vscode-radio-group").forEach(((e3) => {
              e3.dataset.originalVariant || (e3.dataset.originalVariant = e3.variant);
              const i3 = e3.dataset.originalVariant;
              t2 === ge.HORIZONTAL && i3 === ge.HORIZONTAL ? e3.variant = "horizontal" : e3.variant = "vertical";
            }));
          }));
        }
        _resizeObserverCallback(t2) {
          let e2 = 0;
          for (const i3 of t2) e2 = i3.contentRect.width;
          const i2 = e2 < this.breakpoint ? ge.VERTICAL : ge.HORIZONTAL;
          i2 !== this._currentFormGroupLayout && (this._toggleCompactLayout(i2), this._currentFormGroupLayout = i2);
        }
        _activateResponsiveLayout() {
          this._resizeObserver = new ResizeObserver(this._resizeObserverCallbackBound), this._resizeObserver.observe(this._wrapperElement);
        }
        _deactivateResizeObserver() {
          this._resizeObserver?.disconnect(), this._resizeObserver = null;
        }
        firstUpdated() {
          this._firstUpdateComplete = true, this._responsive && this._activateResponsiveLayout();
        }
        render() {
          return U`
      <div class="wrapper">
        <slot></slot>
      </div>
    `;
        }
      };
      xe.styles = fe, me([pt({ type: Boolean, reflect: true })], xe.prototype, "responsive", null), me([pt({ type: Number })], xe.prototype, "breakpoint", void 0), me([ft(".wrapper")], xe.prototype, "_wrapperElement", void 0), me([mt({ selector: "vscode-form-group" })], xe.prototype, "_assignedFormGroups", void 0), xe = me([$t("vscode-form-container")], xe);
      we = [_t, n`
    :host {
      --label-right-margin: 14px;
      --label-width: 150px;

      display: block;
      margin: 15px 0;
    }

    :host([variant='settings-group']) {
      margin: 0;
      padding: 12px 14px 18px;
      max-width: 727px;
    }

    .wrapper {
      display: flex;
      flex-wrap: wrap;
    }

    :host([variant='vertical']) .wrapper,
    :host([variant='settings-group']) .wrapper {
      display: block;
    }

    :host([variant='horizontal']) ::slotted(vscode-checkbox-group),
    :host([variant='horizontal']) ::slotted(vscode-radio-group) {
      width: calc(100% - calc(var(--label-width) + var(--label-right-margin)));
    }

    :host([variant='horizontal']) ::slotted(vscode-label) {
      margin-right: var(--label-right-margin);
      text-align: right;
      width: var(--label-width);
    }

    :host([variant='settings-group']) ::slotted(vscode-label) {
      height: 18px;
      line-height: 18px;
      margin-bottom: 4px;
      margin-right: 0;
      padding: 0;
    }

    ::slotted(vscode-form-helper) {
      margin-left: calc(var(--label-width) + var(--label-right-margin));
    }

    :host([variant='vertical']) ::slotted(vscode-form-helper),
    :host([variant='settings-group']) ::slotted(vscode-form-helper) {
      display: block;
      margin-left: 0;
    }

    :host([variant='settings-group']) ::slotted(vscode-form-helper) {
      margin-bottom: 0;
      margin-top: 0;
    }

    :host([variant='vertical']) ::slotted(vscode-label),
    :host([variant='settings-group']) ::slotted(vscode-label) {
      display: block;
      margin-left: 0;
      text-align: left;
    }

    :host([variant='settings-group']) ::slotted(vscode-inputbox),
    :host([variant='settings-group']) ::slotted(vscode-textfield),
    :host([variant='settings-group']) ::slotted(vscode-textarea),
    :host([variant='settings-group']) ::slotted(vscode-single-select),
    :host([variant='settings-group']) ::slotted(vscode-multi-select) {
      margin-top: 9px;
    }

    ::slotted(vscode-button:first-child) {
      margin-left: calc(var(--label-width) + var(--label-right-margin));
    }

    :host([variant='vertical']) ::slotted(vscode-button) {
      margin-left: 0;
    }

    ::slotted(vscode-button) {
      margin-right: 4px;
    }
  `];
      ye = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      ke = class extends kt {
        constructor() {
          super(...arguments), this.variant = "horizontal";
        }
        render() {
          return U`
      <div class="wrapper">
        <slot></slot>
      </div>
    `;
        }
      };
      ke.styles = we, ye([pt({ reflect: true })], ke.prototype, "variant", void 0), ke = ye([$t("vscode-form-group")], ke);
      $e = [_t, n`
    :host {
      display: block;
      line-height: 1.4em;
      margin-bottom: 4px;
      margin-top: 4px;
      max-width: 720px;
      opacity: 0.9;
    }

    :host([vertical]) {
      margin-left: 0;
    }
  `];
      _e = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      "undefined" != typeof CSSStyleSheet && (Se = new CSSStyleSheet(), Se.replaceSync("\n    vscode-form-helper * {\n      margin: 0;\n    }\n\n    vscode-form-helper *:not(:last-child) {\n      margin-bottom: 8px;\n    }\n  "));
      Ce = class extends kt {
        constructor() {
          super(), this._injectLightDOMStyles();
        }
        _injectLightDOMStyles() {
          if ("undefined" == typeof document || !Se) return;
          const t2 = document.adoptedStyleSheets.find(((t3) => t3 === Se));
          t2 || document.adoptedStyleSheets.push(Se);
        }
        render() {
          return U`<slot></slot>`;
        }
      };
      Ce.styles = $e, Ce = _e([$t("vscode-form-helper")], Ce);
      Be = 0;
      Ae = (t2 = "") => (Be++, `${t2}${Be}`);
      Oe = [_t, n`
    :host {
      display: block;
    }

    .wrapper {
      color: var(--vscode-foreground, #cccccc);
      cursor: default;
      display: block;
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      font-weight: 600;
      line-height: ${1.2307692307692308};
      padding: 5px 0;
    }

    .wrapper.required:after {
      content: ' *';
    }

    ::slotted(.normal) {
      font-weight: normal;
    }

    ::slotted(.lightened) {
      color: var(--vscode-foreground, #cccccc);
      opacity: 0.9;
    }
  `];
      ze = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      Ee = class extends kt {
        constructor() {
          super(...arguments), this.required = false, this._id = "", this._htmlFor = "", this._connected = false;
        }
        set htmlFor(t2) {
          this._htmlFor = t2, this.setAttribute("for", t2), this._connected && this._connectWithTarget();
        }
        get htmlFor() {
          return this._htmlFor;
        }
        set id(t2) {
          this._id = t2;
        }
        get id() {
          return this._id;
        }
        attributeChangedCallback(t2, e2, i2) {
          super.attributeChangedCallback(t2, e2, i2);
        }
        connectedCallback() {
          super.connectedCallback(), this._connected = true, "" === this._id && (this._id = Ae("vscode-label-"), this.setAttribute("id", this._id)), this._connectWithTarget();
        }
        _getTarget() {
          let t2 = null;
          if (this._htmlFor) {
            const e2 = this.getRootNode({ composed: false });
            e2 && (t2 = e2.querySelector(`#${this._htmlFor}`));
          }
          return t2;
        }
        async _connectWithTarget() {
          await this.updateComplete;
          const t2 = this._getTarget();
          ["vscode-radio-group", "vscode-checkbox-group"].includes(t2?.tagName.toLowerCase() ?? "") && t2.setAttribute("aria-labelledby", this._id);
          let e2 = "";
          this.textContent && (e2 = this.textContent.trim()), t2 && "label" in t2 && ["vscode-textfield", "vscode-textarea", "vscode-single-select", "vscode-multi-select"].includes(t2?.tagName.toLowerCase() ?? "") && (t2.label = e2);
        }
        _handleClick() {
          const t2 = this._getTarget();
          t2 && "focus" in t2 && t2.focus();
        }
        render() {
          return U`
      <label
        class=${Mt({ wrapper: true, required: this.required })}
        @click=${this._handleClick}
        ><slot></slot
      ></label>
    `;
        }
      };
      Ee.styles = Oe, ze([pt({ reflect: true, attribute: "for" })], Ee.prototype, "htmlFor", null), ze([pt()], Ee.prototype, "id", null), ze([pt({ type: Boolean, reflect: true })], Ee.prototype, "required", void 0), Ee = ze([$t("vscode-label")], Ee);
      Ie = U`
  <span class="icon">
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M7.976 10.072l4.357-4.357.62.618L8.284 11h-.618L3 6.333l.619-.618 4.357 4.357z"
      />
    </svg>
  </span>
`;
      je = H`<svg
  width="16"
  height="16"
  viewBox="0 0 16 16"
  xmlns="http://www.w3.org/2000/svg"
  fill="currentColor"
>
  <path
    fill-rule="evenodd"
    clip-rule="evenodd"
    d="M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.764.646z"
  />
</svg>`;
      ({ I: Me } = rt);
      De = () => document.createComment("");
      Fe = (t2, e2, i2) => {
        const s2 = t2._$AA.parentNode, o2 = void 0 === e2 ? t2._$AB : e2._$AA;
        if (void 0 === i2) {
          const e3 = s2.insertBefore(De(), o2), r2 = s2.insertBefore(De(), o2);
          i2 = new Me(e3, r2, t2, t2.options);
        } else {
          const e3 = i2._$AB.nextSibling, r2 = i2._$AM, n2 = r2 !== t2;
          if (n2) {
            let e4;
            i2._$AQ?.(t2), i2._$AM = t2, void 0 !== i2._$AP && (e4 = t2._$AU) !== r2._$AU && i2._$AP(e4);
          }
          if (e3 !== o2 || n2) {
            let t3 = i2._$AA;
            for (; t3 !== e3; ) {
              const e4 = t3.nextSibling;
              s2.insertBefore(t3, o2), t3 = e4;
            }
          }
        }
        return i2;
      };
      Pe = (t2, e2, i2 = t2) => (t2._$AI(e2, i2), t2);
      Ve = {};
      Ne = (t2) => {
        t2._$AP?.(false, true);
        let e2 = t2._$AA;
        const i2 = t2._$AB.nextSibling;
        for (; e2 !== i2; ) {
          const t3 = e2.nextSibling;
          e2.remove(), e2 = t3;
        }
      };
      Te = (t2, e2, i2) => {
        const s2 = /* @__PURE__ */ new Map();
        for (let o2 = e2; o2 <= i2; o2++) s2.set(t2[o2], o2);
        return s2;
      };
      Re = It(class extends jt {
        constructor(t2) {
          if (super(t2), t2.type !== zt) throw Error("repeat() can only be used in text expressions");
        }
        dt(t2, e2, i2) {
          let s2;
          void 0 === i2 ? i2 = e2 : void 0 !== e2 && (s2 = e2);
          const o2 = [], r2 = [];
          let n2 = 0;
          for (const e3 of t2) o2[n2] = s2 ? s2(e3, n2) : n2, r2[n2] = i2(e3, n2), n2++;
          return { values: r2, keys: o2 };
        }
        render(t2, e2, i2) {
          return this.dt(t2, e2, i2).values;
        }
        update(t2, [e2, i2, s2]) {
          const o2 = ((t3) => t3._$AH)(t2), { values: r2, keys: n2 } = this.dt(e2, i2, s2);
          if (!Array.isArray(o2)) return this.ut = n2, r2;
          const h2 = this.ut ??= [], a2 = [];
          let l2, c2, d2 = 0, u2 = o2.length - 1, p2 = 0, v2 = r2.length - 1;
          for (; d2 <= u2 && p2 <= v2; ) if (null === o2[d2]) d2++;
          else if (null === o2[u2]) u2--;
          else if (h2[d2] === n2[p2]) a2[p2] = Pe(o2[d2], r2[p2]), d2++, p2++;
          else if (h2[u2] === n2[v2]) a2[v2] = Pe(o2[u2], r2[v2]), u2--, v2--;
          else if (h2[d2] === n2[v2]) a2[v2] = Pe(o2[d2], r2[v2]), Fe(t2, a2[v2 + 1], o2[d2]), d2++, v2--;
          else if (h2[u2] === n2[p2]) a2[p2] = Pe(o2[u2], r2[p2]), Fe(t2, o2[d2], o2[u2]), u2--, p2++;
          else if (void 0 === l2 && (l2 = Te(n2, p2, v2), c2 = Te(h2, d2, u2)), l2.has(h2[d2])) if (l2.has(h2[u2])) {
            const e3 = c2.get(n2[p2]), i3 = void 0 !== e3 ? o2[e3] : null;
            if (null === i3) {
              const e4 = Fe(t2, o2[d2]);
              Pe(e4, r2[p2]), a2[p2] = e4;
            } else a2[p2] = Pe(i3, r2[p2]), Fe(t2, o2[d2], i3), o2[e3] = null;
            p2++;
          } else Ne(o2[u2]), u2--;
          else Ne(o2[d2]), d2++;
          for (; p2 <= v2; ) {
            const e3 = Fe(t2, a2[v2 + 1]);
            Pe(e3, r2[p2]), a2[p2++] = e3;
          }
          for (; d2 <= u2; ) {
            const t3 = o2[d2++];
            null !== t3 && Ne(t3);
          }
          return this.ut = n2, ((t3, e3 = Ve) => {
            t3._$AH = e3;
          })(t2, a2), G;
        }
      });
      Le = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      Ue = class extends kt {
        constructor() {
          super(...arguments), this.description = "", this.selected = false, this.disabled = false, this._initialized = false, this._handleSlotChange = () => {
            this._initialized && this.dispatchEvent(new Event("vsc-option-state-change", { bubbles: true }));
          };
        }
        connectedCallback() {
          super.connectedCallback(), this.updateComplete.then((() => {
            this._initialized = true;
          }));
        }
        willUpdate(t2) {
          this._initialized && (t2.has("description") || t2.has("value") || t2.has("selected") || t2.has("disabled")) && this.dispatchEvent(new Event("vsc-option-state-change", { bubbles: true }));
        }
        render() {
          return U`<slot @slotchange=${this._handleSlotChange}></slot>`;
        }
      };
      Ue.styles = _t, Le([pt({ type: String })], Ue.prototype, "value", void 0), Le([pt({ type: String })], Ue.prototype, "description", void 0), Le([pt({ type: Boolean, reflect: true })], Ue.prototype, "selected", void 0), Le([pt({ type: Boolean, reflect: true })], Ue.prototype, "disabled", void 0), Ue = Le([$t("vscode-option")], Ue);
      He = (t2, e2) => {
        const i2 = { match: false, ranges: [] }, s2 = t2.toLowerCase(), o2 = e2.toLowerCase(), r2 = s2.split(" ");
        let n2 = 0;
        return r2.forEach(((e3, s3) => {
          if (s3 > 0 && (n2 += r2[s3 - 1].length + 1), i2.match) return;
          const h2 = e3.indexOf(o2), a2 = o2.length;
          0 === h2 && (i2.match = true, i2.ranges.push([n2 + h2, Math.min(n2 + h2 + a2, t2.length)]));
        })), i2;
      };
      Ge = (t2, e2) => {
        const i2 = { match: false, ranges: [] };
        return 0 === t2.toLowerCase().indexOf(e2.toLowerCase()) && (i2.match = true, i2.ranges = [[0, e2.length]]), i2;
      };
      qe = (t2, e2) => {
        const i2 = { match: false, ranges: [] }, s2 = t2.toLowerCase().indexOf(e2.toLowerCase());
        return s2 > -1 && (i2.match = true, i2.ranges = [[s2, s2 + e2.length]]), i2;
      };
      We = (t2, e2) => {
        const i2 = { match: false, ranges: [] };
        let s2 = 0, o2 = 0;
        const r2 = e2.length - 1, n2 = t2.toLowerCase(), h2 = e2.toLowerCase();
        for (let t3 = 0; t3 <= r2; t3++) {
          if (o2 = n2.indexOf(h2[t3], s2), -1 === o2) return { match: false, ranges: [] };
          i2.match = true, i2.ranges.push([o2, o2 + 1]), s2 = o2 + 1;
        }
        return i2;
      };
      Ke = (t2) => {
        const e2 = [];
        return " " === t2 ? (e2.push(U`&nbsp;`), e2) : (0 === t2.indexOf(" ") && e2.push(U`&nbsp;`), e2.push(U`${t2.trimStart().trimEnd()}`), t2.lastIndexOf(" ") === t2.length - 1 && e2.push(U`&nbsp;`), e2);
      };
      Xe = class {
        constructor(t2) {
          this._activeIndex = -1, this._options = [], this._filterPattern = "", this._filterMethod = "fuzzy", this._combobox = false, this._indexByValue = /* @__PURE__ */ new Map(), this._indexByLabel = /* @__PURE__ */ new Map(), this._selectedIndex = -1, this._selectedIndexes = /* @__PURE__ */ new Set(), this._multiSelect = false, this._numOfVisibleOptions = 0, (this._host = t2).addController(this);
        }
        hostConnected() {
        }
        get activeIndex() {
          return this._activeIndex;
        }
        set activeIndex(t2) {
          this._activeIndex = t2, this._host.requestUpdate();
        }
        get relativeActiveIndex() {
          return this._options[this._activeIndex]?.filteredIndex ?? -1;
        }
        set comboboxMode(t2) {
          this._combobox = t2, this._host.requestUpdate();
        }
        get comboboxMode() {
          return this._combobox;
        }
        get multiSelect() {
          return this._multiSelect;
        }
        set multiSelect(t2) {
          this._selectedIndex = -1, this._selectedIndexes.clear(), this._multiSelect = t2, this._host.requestUpdate();
        }
        get selectedIndex() {
          return this._selectedIndex;
        }
        set selectedIndex(t2) {
          -1 !== this._selectedIndex && this._options[this._selectedIndex] && (this._options[this._selectedIndex].selected ??= false);
          const e2 = this.getOptionByIndex(t2);
          this._selectedIndex = e2 ? t2 : -1, this._host.requestUpdate();
        }
        get selectedIndexes() {
          return Array.from(this._selectedIndexes);
        }
        set selectedIndexes(t2) {
          this._selectedIndexes.forEach(((t3) => {
            this._options[t3].selected = false;
          })), this._selectedIndexes = new Set(t2), t2.forEach(((t3) => {
            void 0 !== this._options[t3] && (this._options[t3].selected = true);
          })), this._host.requestUpdate();
        }
        set value(t2) {
          if (this._multiSelect) {
            const e2 = t2.map(((t3) => this._indexByValue.get(t3))).filter(((t3) => void 0 !== t3));
            this._selectedIndexes = new Set(e2);
          } else this._selectedIndex = this._indexByValue.get(t2) ?? -1;
          this._host.requestUpdate();
        }
        get value() {
          return this._multiSelect ? this._selectedIndexes.size > 0 ? Array.from(this._selectedIndexes).filter(((t2) => t2 >= 0 && t2 < this._options.length)).map(((t2) => this._options[t2].value)) : [] : this._selectedIndex > -1 && this._selectedIndex < this._options.length ? this._options[this._selectedIndex].value : "";
        }
        set multiSelectValue(t2) {
          const e2 = t2.map(((t3) => this._indexByValue.get(t3))).filter(((t3) => void 0 !== t3));
          this._selectedIndexes = new Set(e2);
        }
        get multiSelectValue() {
          return this._selectedIndexes.size > 0 ? Array.from(this._selectedIndexes).map(((t2) => this._options[t2].value)) : [];
        }
        get filterPattern() {
          return this._filterPattern;
        }
        set filterPattern(t2) {
          t2 !== this._filterPattern && (this._filterPattern = t2, this._updateState());
        }
        get filterMethod() {
          return this._filterMethod;
        }
        set filterMethod(t2) {
          t2 !== this._filterMethod && (this._filterMethod = t2, this._updateState());
        }
        get options() {
          return this._options;
        }
        get numOfVisibleOptions() {
          return this._numOfVisibleOptions;
        }
        get numOptions() {
          return this._options.length;
        }
        populate(t2) {
          this._indexByValue.clear(), this._indexByLabel.clear(), this._options = t2.map(((t3, e2) => (this._indexByValue.set(t3.value ?? "", e2), this._indexByLabel.set(t3.label ?? "", e2), { description: t3.description ?? "", disabled: t3.disabled ?? false, label: t3.label ?? "", selected: t3.selected ?? false, value: t3.value ?? "", index: e2, filteredIndex: e2, ranges: [], visible: true }))), this._numOfVisibleOptions = this._options.length;
        }
        add(t2) {
          const e2 = this._options.length, { description: i2, disabled: s2, label: o2, selected: r2, value: n2 } = t2;
          let h2 = true, a2 = [];
          if (this._combobox && "" !== this._filterPattern) {
            const t3 = this._searchByPattern(o2 ?? "");
            h2 = t3.match, a2 = t3.ranges;
          }
          this._indexByValue.set(n2 ?? "", e2), this._indexByLabel.set(o2 ?? "", e2), r2 && (this._selectedIndex = e2, this._selectedIndexes.add(e2), this._activeIndex = e2), this._options.push({ index: e2, filteredIndex: e2, description: i2 ?? "", disabled: s2 ?? false, label: o2 ?? "", selected: r2 ?? false, value: n2 ?? "", visible: h2, ranges: a2 }), h2 && (this._numOfVisibleOptions += 1);
        }
        clear() {
          this._options = [], this._indexByValue.clear(), this._indexByLabel.clear(), this._numOfVisibleOptions = 0, this._selectedIndex = -1, this._selectedIndexes.clear(), this._activeIndex = -1;
        }
        getIsIndexSelected(t2) {
          return this._multiSelect ? this._selectedIndexes.has(t2) : this._selectedIndex === t2;
        }
        expandMultiSelection(t2) {
          t2.forEach(((t3) => {
            const e2 = this._indexByValue.get(t3) ?? -1;
            -1 !== e2 && this._selectedIndexes.add(e2);
          })), this._host.requestUpdate();
        }
        toggleActiveMultiselectOption() {
          const t2 = this._options[this._activeIndex] ?? null;
          if (!t2) return;
          this._selectedIndexes.has(t2.index) ? this._selectedIndexes.delete(t2.index) : this._selectedIndexes.add(t2.index), this._host.requestUpdate();
        }
        toggleOptionSelected(t2) {
          const e2 = this._selectedIndexes.has(t2);
          this._options[t2].selected = !this._options[t2].selected, e2 ? this._selectedIndexes.delete(t2) : this._selectedIndexes.add(t2), this._host.requestUpdate();
        }
        getActiveOption() {
          return this._options[this._activeIndex] ?? null;
        }
        getSelectedOption() {
          return this._options[this._selectedIndex] ?? null;
        }
        getOptionByIndex(t2) {
          return this._options[t2] ?? null;
        }
        findOptionIndex(t2) {
          return this._indexByValue.get(t2) ?? -1;
        }
        getOptionByValue(t2, e2 = false) {
          const i2 = this._indexByValue.get(t2) ?? -1;
          return -1 === i2 ? null : e2 || this._options[i2].visible ? this._options[i2] : null;
        }
        getOptionByLabel(t2) {
          const e2 = this._indexByLabel.get(t2) ?? -1;
          return -1 === e2 ? null : this._options[e2];
        }
        next(t2) {
          let e2 = -1;
          for (let i2 = (t2 ?? this._activeIndex) + 1; i2 < this._options.length; i2++) if (this._options[i2] && !this._options[i2].disabled && this._options[i2].visible) {
            e2 = i2;
            break;
          }
          return e2 > -1 ? this._options[e2] : null;
        }
        prev(t2) {
          let e2 = -1;
          for (let i2 = (t2 ?? this._activeIndex) - 1; i2 >= 0; i2--) if (this._options[i2] && !this._options[i2].disabled && this._options[i2].visible) {
            e2 = i2;
            break;
          }
          return e2 > -1 ? this._options[e2] : null;
        }
        activateDefault() {
          if (this._multiSelect) {
            if (this._selectedIndexes.size > 0) {
              const t2 = this._selectedIndexes.values().next();
              this._activeIndex = t2.value ? t2.value : 0;
            }
          } else this._selectedIndex > -1 ? this._activeIndex = this._selectedIndex : this._activeIndex = 0;
          this._host.requestUpdate();
        }
        selectAll() {
          this._multiSelect && (this._options.forEach(((t2, e2) => {
            this._options[e2].selected = true, this._selectedIndexes.add(e2);
          })), this._host.requestUpdate());
        }
        selectNone() {
          this._multiSelect && (this._options.forEach(((t2, e2) => {
            this._options[e2].selected = false;
          })), this._selectedIndexes.clear(), this._host.requestUpdate());
        }
        _searchByPattern(t2) {
          let e2;
          switch (this._filterMethod) {
            case "startsWithPerTerm":
              e2 = He(t2, this._filterPattern);
              break;
            case "startsWith":
              e2 = Ge(t2, this._filterPattern);
              break;
            case "contains":
              e2 = qe(t2, this._filterPattern);
              break;
            default:
              e2 = We(t2, this._filterPattern);
          }
          return e2;
        }
        _updateState() {
          if (this._combobox && "" !== this._filterPattern) {
            let t2 = -1;
            this._numOfVisibleOptions = 0, this._options.forEach((({ label: e2 }, i2) => {
              const s2 = this._searchByPattern(e2);
              this._options[i2].visible = s2.match, this._options[i2].ranges = s2.ranges, this._options[i2].filteredIndex = s2.match ? ++t2 : -1, s2.match && (this._numOfVisibleOptions += 1);
            }));
          } else this._options.forEach(((t2, e2) => {
            this._options[e2].visible = true, this._options[e2].ranges = [];
          })), this._numOfVisibleOptions = this._options.length;
          this._host.requestUpdate();
        }
      };
      Je = [_t, n`
    :host {
      display: block;
      position: relative;
    }

    .scrollable-container {
      height: 100%;
      overflow: auto;
    }

    .scrollable-container::-webkit-scrollbar {
      cursor: default;
      width: 0;
    }

    .scrollable-container {
      scrollbar-width: none;
    }

    .shadow {
      box-shadow: var(--vscode-scrollbar-shadow, #000000) 0 6px 6px -6px inset;
      display: none;
      height: 3px;
      left: 0;
      pointer-events: none;
      position: absolute;
      top: 0;
      z-index: 1;
      width: 100%;
    }

    .shadow.visible {
      display: block;
    }

    .scrollbar-track {
      height: 100%;
      position: absolute;
      right: 0;
      top: 0;
      width: 10px;
      z-index: 100;
    }

    .scrollbar-track.hidden {
      display: none;
    }

    .scrollbar-thumb {
      background-color: transparent;
      min-height: var(--min-thumb-height, 20px);
      opacity: 0;
      position: absolute;
      right: 0;
      width: 10px;
    }

    .scrollbar-thumb.visible {
      background-color: var(
        --vscode-scrollbarSlider-background,
        rgba(121, 121, 121, 0.4)
      );
      opacity: 1;
      transition: opacity 100ms;
    }

    .scrollbar-thumb.fade {
      background-color: var(
        --vscode-scrollbarSlider-background,
        rgba(121, 121, 121, 0.4)
      );
      opacity: 0;
      transition: opacity 800ms;
    }

    .scrollbar-thumb.visible:hover {
      background-color: var(
        --vscode-scrollbarSlider-hoverBackground,
        rgba(100, 100, 100, 0.7)
      );
    }

    .scrollbar-thumb.visible.active,
    .scrollbar-thumb.visible.active:hover {
      background-color: var(
        --vscode-scrollbarSlider-activeBackground,
        rgba(191, 191, 191, 0.4)
      );
    }

    .prevent-interaction {
      bottom: 0;
      left: 0;
      right: 0;
      top: 0;
      position: absolute;
      z-index: 99;
    }

    .content {
      overflow: hidden;
    }
  `];
      Ye = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      Ze = class extends kt {
        set scrollPos(t2) {
          this._scrollPos = this._limitScrollPos(t2), this._updateScrollbar(), this._updateThumbPosition(), this.requestUpdate();
        }
        get scrollPos() {
          return this._scrollPos;
        }
        get scrollMax() {
          return this._scrollableContainer ? this._scrollableContainer.scrollHeight - this._scrollableContainer.clientHeight : 0;
        }
        constructor() {
          super(), this.alwaysVisible = false, this.fastScrollSensitivity = 5, this.minThumbSize = 20, this.mouseWheelScrollSensitivity = 1, this.shadow = true, this.scrolled = false, this._scrollPos = 0, this._isDragging = false, this._thumbHeight = 0, this._thumbY = 0, this._thumbVisible = false, this._thumbFade = false, this._thumbActive = false, this._componentHeight = 0, this._contentHeight = 0, this._scrollThumbStartY = 0, this._mouseStartY = 0, this._scrollbarVisible = true, this._scrollbarTrackZ = 0, this._resizeObserverCallback = () => {
            this._componentHeight = this.offsetHeight, this._contentHeight = this._contentElement.offsetHeight, this._updateScrollbar(), this._updateThumbPosition();
          }, this._handleSlotChange = () => {
            this._updateScrollbar(), this._updateThumbPosition(), this._zIndexFix();
          }, this._handleScrollThumbMouseMove = (t2) => {
            const e2 = this._scrollThumbStartY + (t2.screenY - this._mouseStartY);
            this._thumbY = this._limitThumbPos(e2), this.scrollPos = this._calculateScrollPosFromThumbPos(this._thumbY), this.dispatchEvent(new CustomEvent("vsc-scrollable-scroll", { detail: this.scrollPos }));
          }, this._handleScrollThumbMouseUp = (t2) => {
            this._isDragging = false, this._thumbActive = false;
            const e2 = this.getBoundingClientRect(), { x: i2, y: s2, width: o2, height: r2 } = e2, { pageX: n2, pageY: h2 } = t2;
            (n2 > i2 + o2 || n2 < i2 || h2 > s2 + r2 || h2 < s2) && (this._thumbFade = true, this._thumbVisible = false), document.removeEventListener("mousemove", this._handleScrollThumbMouseMove), document.removeEventListener("mouseup", this._handleScrollThumbMouseUp);
          }, this._handleComponentMouseOver = () => {
            this._thumbVisible = true, this._thumbFade = false;
          }, this._handleComponentMouseOut = () => {
            this._thumbActive || (this._thumbVisible = false, this._thumbFade = true);
          }, this._handleComponentWheel = (t2) => {
            if (this._contentHeight <= this._componentHeight) return;
            t2.preventDefault();
            const e2 = t2.altKey ? this.mouseWheelScrollSensitivity * this.fastScrollSensitivity : this.mouseWheelScrollSensitivity;
            this.scrollPos = this._limitScrollPos(this.scrollPos + t2.deltaY * e2), this.dispatchEvent(new CustomEvent("vsc-scrollable-scroll", { detail: this.scrollPos }));
          }, this._handleScrollableContainerScroll = (t2) => {
            t2.currentTarget && (this.scrollPos = t2.currentTarget.scrollTop);
          }, this.addEventListener("mouseover", this._handleComponentMouseOver), this.addEventListener("mouseout", this._handleComponentMouseOut), this.addEventListener("wheel", this._handleComponentWheel);
        }
        connectedCallback() {
          super.connectedCallback(), this._hostResizeObserver = new ResizeObserver(this._resizeObserverCallback), this._contentResizeObserver = new ResizeObserver(this._resizeObserverCallback), this.requestUpdate(), this.updateComplete.then((() => {
            this._hostResizeObserver.observe(this), this._contentResizeObserver.observe(this._contentElement), this._updateThumbPosition();
          }));
        }
        disconnectedCallback() {
          super.disconnectedCallback(), this._hostResizeObserver.unobserve(this), this._hostResizeObserver.disconnect(), this._contentResizeObserver.unobserve(this._contentElement), this._contentResizeObserver.disconnect();
        }
        firstUpdated(t2) {
          this._updateThumbPosition();
        }
        _calcThumbHeight() {
          const t2 = this.offsetHeight, e2 = t2 * (t2 / (this._contentElement?.offsetHeight ?? 0));
          return Math.max(this.minThumbSize, e2);
        }
        _updateScrollbar() {
          const t2 = this._contentElement?.offsetHeight ?? 0;
          this.offsetHeight >= t2 ? this._scrollbarVisible = false : (this._scrollbarVisible = true, this._thumbHeight = this._calcThumbHeight()), this.requestUpdate();
        }
        _zIndexFix() {
          let t2 = 0;
          this._assignedElements.forEach(((e2) => {
            if ("style" in e2) {
              const i2 = window.getComputedStyle(e2).zIndex;
              /([0-9-])+/g.test(i2) && (t2 = Number(i2) > t2 ? Number(i2) : t2);
            }
          })), this._scrollbarTrackZ = t2 + 1, this.requestUpdate();
        }
        _updateThumbPosition() {
          if (!this._scrollableContainer) return;
          this.scrolled = this.scrollPos > 0;
          const t2 = this.offsetHeight, e2 = this._thumbHeight, i2 = this._contentElement.offsetHeight - t2, s2 = this.scrollPos / i2, o2 = t2 - e2;
          this._thumbY = Math.min(s2 * (t2 - e2), o2);
        }
        _calculateScrollPosFromThumbPos(t2) {
          const e2 = this.getBoundingClientRect().height, i2 = t2 / (e2 - this._scrollThumbElement.getBoundingClientRect().height) * (this._contentElement.getBoundingClientRect().height - e2);
          return this._limitScrollPos(i2);
        }
        _limitScrollPos(t2) {
          return t2 < 0 ? 0 : t2 > this.scrollMax ? this.scrollMax : t2;
        }
        _limitThumbPos(t2) {
          const e2 = this.getBoundingClientRect().height, i2 = this._scrollThumbElement.getBoundingClientRect().height;
          return t2 < 0 ? 0 : t2 > e2 - i2 ? e2 - i2 : t2;
        }
        _handleScrollThumbMouseDown(t2) {
          const e2 = this.getBoundingClientRect(), i2 = this._scrollThumbElement.getBoundingClientRect();
          this._mouseStartY = t2.screenY, this._scrollThumbStartY = i2.top - e2.top, this._isDragging = true, this._thumbActive = true, document.addEventListener("mousemove", this._handleScrollThumbMouseMove), document.addEventListener("mouseup", this._handleScrollThumbMouseUp);
        }
        _handleScrollbarTrackPress(t2) {
          t2.target === t2.currentTarget && (this._thumbY = t2.offsetY - this._thumbHeight / 2, this.scrollPos = this._calculateScrollPosFromThumbPos(this._thumbY));
        }
        render() {
          return U`
      <div
        class="scrollable-container"
        .style=${Ft({ userSelect: this._isDragging ? "none" : "auto" })}
        .scrollTop=${this.scrollPos}
        @scroll=${this._handleScrollableContainerScroll}
      >
        <div
          class=${Mt({ shadow: true, visible: this.scrolled })}
          .style=${Ft({ zIndex: String(this._scrollbarTrackZ) })}
        ></div>
        ${this._isDragging ? U`<div class="prevent-interaction"></div>` : q}
        <div
          class=${Mt({ "scrollbar-track": true, hidden: !this._scrollbarVisible })}
          @mousedown=${this._handleScrollbarTrackPress}
        >
          <div
            class=${Mt({ "scrollbar-thumb": true, visible: !!this.alwaysVisible || this._thumbVisible, fade: !this.alwaysVisible && this._thumbFade, active: this._thumbActive })}
            .style=${Ft({ height: `${this._thumbHeight}px`, top: `${this._thumbY}px` })}
            @mousedown=${this._handleScrollThumbMouseDown}
          ></div>
        </div>
        <div class="content">
          <slot @slotchange=${this._handleSlotChange}></slot>
        </div>
      </div>
    `;
        }
      };
      Ze.styles = Je, Ye([pt({ type: Boolean, reflect: true, attribute: "always-visible" })], Ze.prototype, "alwaysVisible", void 0), Ye([pt({ type: Number, attribute: "fast-scroll-sensitivity" })], Ze.prototype, "fastScrollSensitivity", void 0), Ye([pt({ type: Number, attribute: "min-thumb-size" })], Ze.prototype, "minThumbSize", void 0), Ye([pt({ type: Number, attribute: "mouse-wheel-scroll-sensitivity" })], Ze.prototype, "mouseWheelScrollSensitivity", void 0), Ye([pt({ type: Boolean, reflect: true })], Ze.prototype, "shadow", void 0), Ye([pt({ type: Boolean, reflect: true })], Ze.prototype, "scrolled", void 0), Ye([pt({ type: Number, attribute: "scroll-pos" })], Ze.prototype, "scrollPos", null), Ye([vt()], Ze.prototype, "_isDragging", void 0), Ye([vt()], Ze.prototype, "_thumbHeight", void 0), Ye([vt()], Ze.prototype, "_thumbY", void 0), Ye([vt()], Ze.prototype, "_thumbVisible", void 0), Ye([vt()], Ze.prototype, "_thumbFade", void 0), Ye([vt()], Ze.prototype, "_thumbActive", void 0), Ye([ft(".content")], Ze.prototype, "_contentElement", void 0), Ye([ft(".scrollbar-thumb", true)], Ze.prototype, "_scrollThumbElement", void 0), Ye([ft(".scrollable-container")], Ze.prototype, "_scrollableContainer", void 0), Ye([mt()], Ze.prototype, "_assignedElements", void 0), Ze = Ye([$t("vscode-scrollable")], Ze);
      Qe = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      ti = 22;
      ei = class extends kt {
        set combobox(t2) {
          this._opts.comboboxMode = t2;
        }
        get combobox() {
          return this._opts.comboboxMode;
        }
        set disabled(t2) {
          this._disabled = t2, this.ariaDisabled = t2 ? "true" : "false", true === t2 ? (this._originalTabIndex = this.tabIndex, this.tabIndex = -1) : (this.tabIndex = this._originalTabIndex ?? 0, this._originalTabIndex = void 0), this.requestUpdate();
        }
        get disabled() {
          return this._disabled;
        }
        set filter(t2) {
          let e2;
          ["contains", "fuzzy", "startsWith", "startsWithPerTerm"].includes(t2) ? e2 = t2 : (this.warn(`Invalid filter: "${t2}", fallback to default. Valid values are: "contains", "fuzzy", "startsWith", "startsWithPerm".`), e2 = "fuzzy"), this._opts.filterMethod = e2;
        }
        get filter() {
          return this._opts.filterMethod;
        }
        set options(t2) {
          this._opts.populate(t2);
        }
        get options() {
          return this._opts.options.map((({ label: t2, value: e2, description: i2, selected: s2, disabled: o2 }) => ({ label: t2, value: e2, description: i2, selected: s2, disabled: o2 })));
        }
        constructor() {
          super(), this.creatable = false, this.label = "", this.invalid = false, this.focused = false, this.open = false, this.position = "below", this._prevXPos = 0, this._prevYPos = 0, this._opts = new Xe(this), this._firstUpdateCompleted = false, this._currentDescription = "", this._filter = "fuzzy", this._selectedIndexes = [], this._options = [], this._value = "", this._values = [], this._isPlaceholderOptionActive = false, this._isBeingFiltered = false, this._optionListScrollPos = 0, this._isHoverForbidden = false, this._disabled = false, this._originalTabIndex = void 0, this._onMouseMove = () => {
            this._isHoverForbidden = false, window.removeEventListener("mousemove", this._onMouseMove);
          }, this._onOptionListScroll = (t2) => {
            this._optionListScrollPos = t2.detail;
          }, this._onComponentKeyDown = (t2) => {
            [" ", "ArrowUp", "ArrowDown", "Escape"].includes(t2.key) && (t2.stopPropagation(), t2.preventDefault()), "Enter" === t2.key && this._onEnterKeyDown(t2), " " === t2.key && this._onSpaceKeyDown(), "Escape" === t2.key && this._onEscapeKeyDown(), "ArrowUp" === t2.key && this._onArrowUpKeyDown(), "ArrowDown" === t2.key && this._onArrowDownKeyDown();
          }, this._onComponentFocus = () => {
            this.focused = true;
          }, this._onComponentBlur = () => {
            this.focused = false;
          }, this._handleWindowScroll = () => {
            const { x: t2, y: e2 } = this.getBoundingClientRect();
            t2 === this._prevXPos && e2 === this._prevYPos || (this.open = false);
          }, this.addEventListener("vsc-option-state-change", ((t2) => {
            t2.stopPropagation(), this._setStateFromSlottedElements(), this.requestUpdate();
          }));
        }
        connectedCallback() {
          super.connectedCallback(), this.addEventListener("keydown", this._onComponentKeyDown), this.addEventListener("focus", this._onComponentFocus), this.addEventListener("blur", this._onComponentBlur), this._setAutoFocus();
        }
        disconnectedCallback() {
          super.disconnectedCallback(), this.removeEventListener("keydown", this._onComponentKeyDown), this.removeEventListener("focus", this._onComponentFocus), this.removeEventListener("blur", this._onComponentBlur);
        }
        firstUpdated(t2) {
          this._firstUpdateCompleted = true;
        }
        willUpdate(t2) {
          if (t2.has("required") && this._firstUpdateCompleted && this._manageRequired(), t2.has("open") && this._firstUpdateCompleted) if (this.open) {
            this._dropdownEl.showPopover();
            const { x: t3, y: e2 } = this.getBoundingClientRect();
            this._prevXPos = t3, this._prevYPos = e2, window.addEventListener("scroll", this._handleWindowScroll, { capture: true }), this._opts.activateDefault(), this._scrollActiveElementToTop();
          } else this._dropdownEl.hidePopover(), window.removeEventListener("scroll", this._handleWindowScroll);
        }
        get _filteredOptions() {
          return this.combobox && "" !== this._opts.filterPattern ? ((t2, e2, i2) => {
            const s2 = [];
            return t2.forEach(((t3) => {
              let o2;
              switch (i2) {
                case "startsWithPerTerm":
                  o2 = He(t3.label, e2);
                  break;
                case "startsWith":
                  o2 = Ge(t3.label, e2);
                  break;
                case "contains":
                  o2 = qe(t3.label, e2);
                  break;
                default:
                  o2 = We(t3.label, e2);
              }
              o2.match && s2.push({ ...t3, ranges: o2.ranges });
            })), s2;
          })(this._options, this._opts.filterPattern, this._filter) : this._options;
        }
        _setAutoFocus() {
          this.hasAttribute("autofocus") && (this.tabIndex < 0 && (this.tabIndex = 0), this.combobox ? this.updateComplete.then((() => {
            this.shadowRoot?.querySelector(".combobox-input").focus();
          })) : this.updateComplete.then((() => {
            this.shadowRoot?.querySelector(".select-face").focus();
          })));
        }
        get _isSuggestedOptionVisible() {
          if (!this.combobox || !this.creatable) return false;
          const t2 = null !== this._opts.getOptionByValue(this._opts.filterPattern), e2 = this._opts.filterPattern.length > 0;
          return !t2 && e2;
        }
        _manageRequired() {
        }
        _setStateFromSlottedElements() {
          const t2 = this._assignedOptions ?? [];
          this._opts.clear(), t2.forEach(((t3) => {
            const { innerText: e2, description: i2, disabled: s2 } = t3, o2 = "string" == typeof t3.value ? t3.value : e2.trim(), r2 = t3.selected ?? false, n2 = { label: e2.trim(), value: o2, description: i2, selected: r2, disabled: s2 };
            this._opts.add(n2);
          }));
        }
        _createSuggestedOption() {
          const t2 = this._opts.numOptions, e2 = document.createElement("vscode-option");
          return e2.value = this._opts.filterPattern, ht(this._opts.filterPattern, e2), this.appendChild(e2), t2;
        }
        _dispatchChangeEvent() {
          this.dispatchEvent(new Event("change")), this.dispatchEvent(new Event("input"));
        }
        async _createAndSelectSuggestedOption() {
        }
        _toggleComboboxDropdown() {
          this._opts.filterPattern = "", this.open = !this.open;
        }
        _scrollActiveElementToTop() {
          this._optionListScrollPos = Math.floor(this._opts.relativeActiveIndex * ti);
        }
        async _adjustOptionListScrollPos(t2, e2) {
          let i2 = this._opts.numOfVisibleOptions;
          if (this._isSuggestedOptionVisible && (i2 += 1), i2 <= 10) return;
          this._isHoverForbidden = true, window.addEventListener("mousemove", this._onMouseMove);
          const s2 = this._optionListScrollPos, o2 = e2 * ti, r2 = o2 >= s2 && o2 <= s2 + 220 - ti;
          "down" === t2 && (r2 || (this._optionListScrollPos = e2 * ti - 198)), "up" === t2 && (r2 || (this._optionListScrollPos = Math.floor(this._opts.relativeActiveIndex * ti)));
        }
        _onFaceClick() {
          this.open = !this.open;
        }
        _handleDropdownToggle(t2) {
          this.open = "open" === t2.newState;
        }
        _onComboboxButtonClick() {
          this._toggleComboboxDropdown();
        }
        _onComboboxButtonKeyDown(t2) {
          "Enter" === t2.key && this._toggleComboboxDropdown();
        }
        _onOptionMouseOver(t2) {
          if (this._isHoverForbidden) return;
          const e2 = t2.target;
          e2.matches(".option") && (e2.matches(".placeholder") ? (this._isPlaceholderOptionActive = true, this._opts.activeIndex = -1) : (this._isPlaceholderOptionActive = false, this._opts.activeIndex = +e2.dataset.index));
        }
        _onPlaceholderOptionMouseOut() {
          this._isPlaceholderOptionActive = false;
        }
        _onNoOptionsClick(t2) {
          t2.stopPropagation();
        }
        _onEnterKeyDown(t2) {
          this._isBeingFiltered = false;
          !!t2?.composedPath && t2.composedPath().find(((t3) => !!t3.matches && t3.matches("vscode-button.button-accept")));
        }
        _onSpaceKeyDown() {
          this.open || (this.open = true);
        }
        _onArrowUpKeyDown() {
          if (this.open) {
            if (this._opts.activeIndex <= 0 && (!this.combobox || !this.creatable)) return;
            if (this._isPlaceholderOptionActive) {
              const t2 = this._opts.numOfVisibleOptions - 1;
              this._opts.activeIndex = t2, this._isPlaceholderOptionActive = false;
            } else {
              const t2 = this._opts.prev();
              if (null !== t2) {
                this._opts.activeIndex = t2?.index ?? -1;
                const e2 = t2?.filteredIndex ?? -1;
                e2 > -1 && this._adjustOptionListScrollPos("up", e2);
              }
            }
          } else this.open = true, this._opts.activateDefault();
        }
        _onArrowDownKeyDown() {
          let t2 = this._opts.numOfVisibleOptions;
          const e2 = this._isSuggestedOptionVisible;
          if (e2 && (t2 += 1), this.open) {
            if (this._isPlaceholderOptionActive && -1 === this._opts.activeIndex) return;
            const i2 = this._opts.next();
            if (e2 && null === i2) this._isPlaceholderOptionActive = true, this._adjustOptionListScrollPos("down", t2 - 1), this._opts.activeIndex = -1;
            else if (null !== i2) {
              const t3 = i2?.filteredIndex ?? -1;
              this._opts.activeIndex = i2?.index ?? -1, t3 > -1 && this._adjustOptionListScrollPos("down", t3);
            }
          } else this.open = true, this._opts.activateDefault();
        }
        _onEscapeKeyDown() {
          this.open = false;
        }
        _onSlotChange() {
          this._setStateFromSlottedElements(), this.requestUpdate();
        }
        _onComboboxInputFocus(t2) {
          t2.target.select(), this._isBeingFiltered = false, this._opts.filterPattern = "";
        }
        _onComboboxInputBlur() {
          this._isBeingFiltered = false;
        }
        _onComboboxInputInput(t2) {
          this._isBeingFiltered = true, this._opts.filterPattern = t2.target.value, this._opts.activeIndex = -1, this.open = true;
        }
        _onComboboxInputClick() {
          this._isBeingFiltered = "" !== this._opts.filterPattern, this.open = true;
        }
        _onComboboxInputSpaceKeyDown(t2) {
          " " === t2.key && t2.stopPropagation();
        }
        _onOptionClick(t2) {
          this._isBeingFiltered = false;
        }
        _renderCheckbox(t2, e2) {
          return U`<span class=${Mt({ "checkbox-icon": true, checked: t2 })}>${je}</span
      ><span class="option-label">${e2}</span>`;
        }
        _renderOptions() {
          const t2 = this._opts.options;
          return U`
      <ul
        aria-label=${Dt(this.label ?? void 0)}
        aria-multiselectable=${Dt(this._opts.multiSelect ? "true" : void 0)}
        class="options"
        id="select-listbox"
        role="listbox"
        tabindex="-1"
        @click=${this._onOptionClick}
        @mouseover=${this._onOptionMouseOver}
      >
        ${Re(t2, ((t3) => t3.index), ((t3, e2) => {
            if (!t3.visible) return q;
            const i2 = t3.index === this._opts.activeIndex && !t3.disabled, s2 = this._opts.getIsIndexSelected(t3.index), o2 = { active: i2, disabled: t3.disabled, option: true, "single-select": !this._opts.multiSelect, "multi-select": this._opts.multiSelect, selected: s2 }, r2 = t3.ranges?.length ? ((t4, e3) => {
              const i3 = [], s3 = e3.length;
              return s3 < 1 ? U`${t4}` : (e3.forEach(((o3, r3) => {
                const n2 = t4.substring(o3[0], o3[1]);
                0 === r3 && 0 !== o3[0] && i3.push(...Ke(t4.substring(0, e3[0][0]))), r3 > 0 && r3 < s3 && o3[0] - e3[r3 - 1][1] != 0 && i3.push(...Ke(t4.substring(e3[r3 - 1][1], o3[0]))), i3.push(U`<b>${Ke(n2)}</b>`), r3 === s3 - 1 && o3[1] < t4.length && i3.push(...Ke(t4.substring(o3[1], t4.length)));
              })), i3);
            })(t3.label, t3.ranges ?? []) : t3.label;
            return U`
              <li
                aria-selected=${s2 ? "true" : "false"}
                class=${Mt(o2)}
                data-index=${t3.index}
                data-filtered-index=${e2}
                id=${`op-${t3.index}`}
                role="option"
                tabindex="-1"
              >
                ${(function(t4, e3, i3) {
              return t4 ? e3(t4) : i3?.(t4);
            })(this._opts.multiSelect, (() => this._renderCheckbox(s2, r2)), (() => r2))}
              </li>
            `;
          }))}
        ${this._renderPlaceholderOption(this._opts.numOfVisibleOptions < 1)}
      </ul>
    `;
        }
        _renderPlaceholderOption(t2) {
          if (!this.combobox) return q;
          return this._opts.getOptionByLabel(this._opts.filterPattern) ? q : this.creatable && this._opts.filterPattern.length > 0 ? U`<li
        class=${Mt({ option: true, placeholder: true, active: this._isPlaceholderOptionActive })}
        @mouseout=${this._onPlaceholderOptionMouseOut}
      >
        Add "${this._opts.filterPattern}"
      </li>` : t2 ? U`<li class="no-options" @click=${this._onNoOptionsClick}>
            No options
          </li>` : q;
        }
        _renderDescription() {
          const t2 = this._opts.getActiveOption();
          if (!t2) return q;
          const { description: e2 } = t2;
          return e2 ? U`<div class="description">${e2}</div>` : q;
        }
        _renderSelectFace() {
          return U`${q}`;
        }
        _renderComboboxFace() {
          return U`${q}`;
        }
        _renderDropdownControls() {
          return U`${q}`;
        }
        _renderDropdown() {
          const t2 = { dropdown: true, multiple: this._opts.multiSelect, open: this.open }, e2 = this._isSuggestedOptionVisible || 0 === this._opts.numOfVisibleOptions ? this._opts.numOfVisibleOptions + 1 : this._opts.numOfVisibleOptions, i2 = Math.min(e2 * ti, 220), s2 = this.getBoundingClientRect(), o2 = { width: `${s2.width}px`, left: `${s2.left}px`, top: "below" === this.position ? `${s2.top + s2.height}px` : "unset", bottom: "below" === this.position ? "unset" : document.documentElement.clientHeight - s2.top + "px" };
          return U`
      <div
        class=${Mt(t2)}
        popover="auto"
        @toggle=${this._handleDropdownToggle}
        .style=${Ft(o2)}
      >
        ${"above" === this.position ? this._renderDescription() : q}
        <vscode-scrollable
          always-visible
          class="scrollable"
          min-thumb-size="40"
          tabindex="-1"
          @vsc-scrollable-scroll=${this._onOptionListScroll}
          .scrollPos=${this._optionListScrollPos}
          .style=${Ft({ height: `${i2}px` })}
        >
          ${this._renderOptions()} ${this._renderDropdownControls()}
        </vscode-scrollable>
        ${"below" === this.position ? this._renderDescription() : q}
      </div>
    `;
        }
      };
      Qe([pt({ type: Boolean, reflect: true })], ei.prototype, "creatable", void 0), Qe([pt({ type: Boolean, reflect: true })], ei.prototype, "combobox", null), Qe([pt({ reflect: true })], ei.prototype, "label", void 0), Qe([pt({ type: Boolean, reflect: true })], ei.prototype, "disabled", null), Qe([pt({ type: Boolean, reflect: true })], ei.prototype, "invalid", void 0), Qe([pt()], ei.prototype, "filter", null), Qe([pt({ type: Boolean, reflect: true })], ei.prototype, "focused", void 0), Qe([pt({ type: Boolean, reflect: true })], ei.prototype, "open", void 0), Qe([pt({ type: Array })], ei.prototype, "options", null), Qe([pt({ reflect: true })], ei.prototype, "position", void 0), Qe([mt({ flatten: true, selector: "vscode-option" })], ei.prototype, "_assignedOptions", void 0), Qe([ft(".dropdown", true)], ei.prototype, "_dropdownEl", void 0), Qe([vt()], ei.prototype, "_currentDescription", void 0), Qe([vt()], ei.prototype, "_filter", void 0), Qe([vt()], ei.prototype, "_filteredOptions", null), Qe([vt()], ei.prototype, "_selectedIndexes", void 0), Qe([vt()], ei.prototype, "_options", void 0), Qe([vt()], ei.prototype, "_value", void 0), Qe([vt()], ei.prototype, "_values", void 0), Qe([vt()], ei.prototype, "_isPlaceholderOptionActive", void 0), Qe([vt()], ei.prototype, "_isBeingFiltered", void 0), Qe([vt()], ei.prototype, "_optionListScrollPos", void 0);
      ii = [_t, n`
    :host {
      display: inline-block;
      max-width: 100%;
      outline: none;
      position: relative;
      width: 320px;
    }

    .main-slot {
      display: none;
    }

    .select-face,
    .combobox-face {
      background-color: var(--vscode-settings-dropdownBackground, #313131);
      border-color: var(--vscode-settings-dropdownBorder, #3c3c3c);
      border-radius: 4px;
      border-style: solid;
      border-width: 1px;
      box-sizing: border-box;
      color: var(--vscode-settings-dropdownForeground, #cccccc);
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      font-weight: var(--vscode-font-weight, normal);
      line-height: 18px;
      position: relative;
      user-select: none;
      width: 100%;
    }

    :host([invalid]) .select-face,
    :host(:invalid) .select-face,
    :host([invalid]) .combobox-face,
    :host(:invalid) .combobox-face {
      background-color: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      border-color: var(--vscode-inputValidation-errorBorder, #be1100);
    }

    .select-face {
      cursor: pointer;
      display: block;
      padding: 3px 4px;
    }

    .select-face .text {
      display: block;
      height: 18px;
      overflow: hidden;
      padding-right: 20px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .select-face.multiselect {
      padding: 0;
    }

    .select-face-badge {
      background-color: var(--vscode-badge-background, #616161);
      border-radius: 2px;
      color: var(--vscode-badge-foreground, #f8f8f8);
      display: inline-block;
      flex-shrink: 0;
      font-size: 11px;
      line-height: 16px;
      margin: 2px;
      padding: 2px 3px;
      white-space: nowrap;
    }

    .select-face-badge.no-item {
      background-color: transparent;
      color: inherit;
    }

    .combobox-face {
      display: flex;
    }

    :host(:focus) .select-face,
    :host(:focus) .combobox-face,
    :host([focused]) .select-face,
    :host([focused]) .combobox-face {
      outline: none;
    }

    :host(:focus:not([open])) .select-face,
    :host(:focus:not([open])) .combobox-face,
    :host([focused]:not([open])) .select-face,
    :host([focused]:not([open])) .combobox-face {
      border-color: var(--vscode-focusBorder, #0078d4);
    }

    .combobox-input {
      background-color: transparent;
      box-sizing: border-box;
      border: 0;
      color: var(--vscode-foreground, #cccccc);
      display: block;
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      line-height: 16px;
      padding: 4px;
      width: 100%;
    }

    .combobox-input:focus {
      outline: none;
    }

    .combobox-button {
      align-items: center;
      background-color: transparent;
      border: 0;
      border-radius: 2px;
      box-sizing: content-box;
      color: var(--vscode-foreground, #cccccc);
      cursor: pointer;
      display: flex;
      flex-shrink: 0;
      height: 16px;
      justify-content: center;
      margin: 1px 1px 0 0;
      padding: 3px;
      width: 22px;
    }

    .combobox-button:hover,
    .combobox-button:focus-visible {
      background-color: var(
        --vscode-toolbar-hoverBackground,
        rgba(90, 93, 94, 0.31)
      );
      outline-style: dashed;
      outline-color: var(--vscode-toolbar-hoverOutline, transparent);
    }

    .combobox-button:focus-visible {
      outline: none;
    }

    .icon {
      color: var(--vscode-foreground, #cccccc);
      display: block;
      height: 14px;
      pointer-events: none;
      width: 14px;
    }

    .select-face .icon {
      position: absolute;
      right: 6px;
      top: 5px;
    }

    .icon svg {
      color: var(--vscode-foreground, #cccccc);
      height: 100%;
      width: 100%;
    }

    .dropdown {
      background-color: var(--vscode-settings-dropdownBackground, #313131);
      border-color: var(--vscode-settings-dropdownListBorder, #454545);
      border-radius: 4px;
      border-style: solid;
      border-width: 1px;
      bottom: unset;
      box-shadow: 0 2px 8px var(--vscode-widget-shadow, rgba(0, 0, 0, 0.36));
      box-sizing: border-box;
      display: none;
      padding: 0;
      right: unset;
    }

    .dropdown.open {
      display: block;
    }

    :host([position='above']) .dropdown {
      bottom: 26px;
      padding-bottom: 0;
      padding-top: 2px;
      top: unset;
    }

    .scrollable {
      display: block;
      max-height: 222px;
      margin: 0;
      outline: none;
      overflow: hidden;
    }

    .options {
      box-sizing: border-box;
      cursor: pointer;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .option {
      box-sizing: border-box;
      color: var(--vscode-foreground, #cccccc);
      cursor: pointer;
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      font-weight: var(--vscode-font-weight, normal);
      height: 22px;
      line-height: 20px;
      min-height: calc(var(--vscode-font-size) * 1.3);
      padding: 1px 3px;
      user-select: none;
      outline-color: transparent;
      outline-offset: -1px;
      outline-style: solid;
      outline-width: 1px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .option.single-select {
      display: block;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .option.multi-select {
      align-items: center;
      display: flex;
    }

    .option b {
      color: var(--vscode-list-highlightForeground, #2aaaff);
    }

    .option.active b {
      color: var(--vscode-list-focusHighlightForeground, #2aaaff);
    }

    .option:not(.disabled):hover {
      background-color: var(--vscode-list-hoverBackground, #2a2d2e);
      color: var(--vscode-list-hoverForeground, #ffffff);
    }

    :host-context(body[data-vscode-theme-kind='vscode-high-contrast'])
      .option:hover,
    :host-context(body[data-vscode-theme-kind='vscode-high-contrast-light'])
      .option:hover {
      outline-style: dotted;
      outline-color: var(--vscode-list-focusOutline, #0078d4);
      outline-width: 1px;
    }

    .option.disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }

    .option.active,
    .option.active:hover {
      background-color: var(--vscode-list-activeSelectionBackground, #04395e);
      color: var(--vscode-list-activeSelectionForeground, #ffffff);
      outline-color: var(--vscode-list-activeSelectionBackground, #04395e);
      outline-style: solid;
      outline-width: 1px;
    }

    .no-options {
      align-items: center;
      border-color: transparent;
      border-style: solid;
      border-width: 1px;
      color: var(--vscode-foreground, #cccccc);
      cursor: default;
      display: flex;
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      font-weight: var(--vscode-font-weight, normal);
      line-height: 18px;
      min-height: calc(var(--vscode-font-size) * 1.3);
      opacity: 0.85;
      padding: 1px 3px;
      user-select: none;
    }

    .placeholder {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .placeholder span {
      font-weight: bold;
    }

    .placeholder:not(.disabled):hover {
      color: var(--vscode-list-activeSelectionForeground, #ffffff);
    }

    :host-context(body[data-vscode-theme-kind='vscode-high-contrast'])
      .option.active,
    :host-context(body[data-vscode-theme-kind='vscode-high-contrast-light'])
      .option.active:hover {
      outline-color: var(--vscode-list-focusOutline, #0078d4);
      outline-style: dashed;
    }

    .option-label {
      display: block;
      overflow: hidden;
      pointer-events: none;
      text-overflow: ellipsis;
      white-space: nowrap;
      width: 100%;
    }

    .dropdown.multiple .option.selected {
      background-color: var(--vscode-list-hoverBackground, #2a2d2e);
      outline-color: var(--vscode-list-hoverBackground, #2a2d2e);
    }

    .dropdown.multiple .option.selected.active {
      background-color: var(--vscode-list-activeSelectionBackground, #04395e);
      color: var(--vscode-list-activeSelectionForeground, #ffffff);
      outline-color: var(--vscode-list-activeSelectionBackground, #04395e);
    }

    .checkbox-icon {
      align-items: center;
      background-color: var(--vscode-checkbox-background, #313131);
      border-radius: 2px;
      border: 1px solid var(--vscode-checkbox-border);
      box-sizing: border-box;
      color: var(--vscode-checkbox-foreground);
      display: flex;
      flex-basis: 15px;
      flex-shrink: 0;
      height: 15px;
      justify-content: center;
      margin-right: 5px;
      overflow: hidden;
      position: relative;
      width: 15px;
    }

    .checkbox-icon svg {
      display: none;
      height: 13px;
      width: 13px;
    }

    .checkbox-icon.checked svg {
      display: block;
    }

    .dropdown-controls {
      display: flex;
      justify-content: flex-end;
      padding: 4px;
    }

    .dropdown-controls :not(:last-child) {
      margin-right: 4px;
    }

    .action-icon {
      align-items: center;
      background-color: transparent;
      border: 0;
      color: var(--vscode-foreground, #cccccc);
      cursor: pointer;
      display: flex;
      height: 24px;
      justify-content: center;
      padding: 0;
      width: 24px;
    }

    .action-icon:focus {
      outline: none;
    }

    .action-icon:focus-visible {
      outline: 1px solid var(--vscode-focusBorder, #0078d4);
      outline-offset: -1px;
    }

    .description {
      border-color: var(--vscode-settings-dropdownBorder, #3c3c3c);
      border-style: solid;
      border-width: 1px 0 0;
      color: var(--vscode-foreground, #cccccc);
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      font-weight: var(--vscode-font-weight, normal);
      line-height: 1.3;
      padding: 6px 4px;
      word-wrap: break-word;
    }

    :host([position='above']) .description {
      border-width: 0 0 1px;
    }
  `];
      si = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      oi = class extends ei {
        set selectedIndexes(t2) {
          this._opts.selectedIndexes = t2;
        }
        get selectedIndexes() {
          return this._opts.selectedIndexes;
        }
        set value(t2) {
          this._opts.multiSelectValue = t2, this._opts.selectedIndexes.length > 0 ? this._requestedValueToSetLater = [] : this._requestedValueToSetLater = Array.isArray(t2) ? t2 : [t2], this._setFormValue(), this._manageRequired();
        }
        get value() {
          return this._opts.multiSelectValue;
        }
        get form() {
          return this._internals.form;
        }
        get type() {
          return "select-multiple";
        }
        get validity() {
          return this._internals.validity;
        }
        get validationMessage() {
          return this._internals.validationMessage;
        }
        get willValidate() {
          return this._internals.willValidate;
        }
        checkValidity() {
          return this._internals.checkValidity();
        }
        reportValidity() {
          return this._internals.reportValidity();
        }
        selectAll() {
          this._opts.selectAll();
        }
        selectNone() {
          this._opts.selectNone();
        }
        constructor() {
          super(), this.defaultValue = [], this.required = false, this.name = void 0, this._requestedValueToSetLater = [], this._onOptionClick = (t2) => {
            const e2 = t2.composedPath().find(((t3) => "matches" in t3 && t3.matches("li.option")));
            if (!e2) return;
            if (e2.classList.contains("placeholder")) return void this._createAndSelectSuggestedOption();
            const i2 = Number(e2.dataset.index);
            this._opts.toggleOptionSelected(i2), this._setFormValue(), this._manageRequired(), this._dispatchChangeEvent();
          }, this._opts.multiSelect = true, this._internals = this.attachInternals();
        }
        connectedCallback() {
          super.connectedCallback(), this.updateComplete.then((() => {
            this._setDefaultValue(), this._manageRequired();
          }));
        }
        formResetCallback() {
          this.updateComplete.then((() => {
            this.value = this.defaultValue;
          }));
        }
        formStateRestoreCallback(t2, e2) {
          const i2 = Array.from(t2.entries()).map(((t3) => String(t3[1])));
          this.updateComplete.then((() => {
            this.value = i2;
          }));
        }
        _setDefaultValue() {
          if (Array.isArray(this.defaultValue) && this.defaultValue.length > 0) {
            const t2 = this.defaultValue.map(((t3) => String(t3)));
            this.value = t2;
          }
        }
        _dispatchChangeEvent() {
          super._dispatchChangeEvent();
        }
        _onFaceClick() {
          super._onFaceClick(), this._opts.activeIndex = 0;
        }
        _toggleComboboxDropdown() {
          super._toggleComboboxDropdown(), this._opts.activeIndex = -1;
        }
        _manageRequired() {
          const { value: t2 } = this;
          0 === t2.length && this.required ? this._internals.setValidity({ valueMissing: true }, "Please select an item in the list.", this._faceElement) : this._internals.setValidity({});
        }
        _setFormValue() {
          const t2 = new FormData();
          this._values.forEach(((e2) => {
            t2.append(this.name ?? "", e2);
          })), this._internals.setFormValue(t2);
        }
        async _createAndSelectSuggestedOption() {
          super._createAndSelectSuggestedOption();
          const t2 = this._createSuggestedOption();
          await this.updateComplete, this.selectedIndexes = [...this.selectedIndexes, t2], this._dispatchChangeEvent();
          const e2 = new CustomEvent("vsc-multi-select-create-option", { detail: { value: this._opts.getOptionByIndex(t2)?.value ?? "" } });
          this.dispatchEvent(e2), this.open = false, this._isPlaceholderOptionActive = false;
        }
        _onSlotChange() {
          super._onSlotChange(), this._requestedValueToSetLater.length > 0 && (this._opts.expandMultiSelection(this._requestedValueToSetLater), this._requestedValueToSetLater = this._requestedValueToSetLater.filter(((t2) => -1 === this._opts.findOptionIndex(t2))));
        }
        _onEnterKeyDown(t2) {
          super._onEnterKeyDown(t2), this.open ? this._isPlaceholderOptionActive ? this._createAndSelectSuggestedOption() : (this._opts.toggleActiveMultiselectOption(), this._setFormValue(), this._manageRequired(), this._dispatchChangeEvent()) : (this._opts.filterPattern = "", this.open = true);
        }
        _onMultiAcceptClick() {
          this.open = false;
        }
        _onMultiDeselectAllClick() {
          this._opts.selectedIndexes = [], this._values = [], this._options = this._options.map(((t2) => ({ ...t2, selected: false }))), this._manageRequired(), this._dispatchChangeEvent();
        }
        _onMultiSelectAllClick() {
          this._opts.selectedIndexes = [], this._values = [], this._options = this._options.map(((t2) => ({ ...t2, selected: true }))), this._options.forEach(((t2, e2) => {
            this._selectedIndexes.push(e2), this._values.push(t2.value), this._dispatchChangeEvent();
          })), this._setFormValue(), this._manageRequired();
        }
        _onComboboxInputBlur() {
          super._onComboboxInputBlur(), this._opts.filterPattern = "";
        }
        _renderLabel() {
          return 0 === this._opts.selectedIndexes.length ? U`<span class="select-face-badge no-item">0 Selected</span>` : U`<span class="select-face-badge"
          >${this._opts.selectedIndexes.length} Selected</span
        >`;
        }
        _renderComboboxFace() {
          const t2 = this._opts.activeIndex > -1 ? `op-${this._opts.activeIndex}` : "", e2 = this.open ? "true" : "false";
          return U`
      <div class="combobox-face face">
        ${this._opts.multiSelect ? this._renderLabel() : q}
        <input
          aria-activedescendant=${t2}
          aria-autocomplete="list"
          aria-controls="select-listbox"
          aria-expanded=${e2}
          aria-haspopup="listbox"
          aria-label=${Dt(this.label)}
          class="combobox-input"
          role="combobox"
          spellcheck="false"
          type="text"
          autocomplete="off"
          .value=${this._opts.filterPattern}
          @focus=${this._onComboboxInputFocus}
          @blur=${this._onComboboxInputBlur}
          @input=${this._onComboboxInputInput}
          @click=${this._onComboboxInputClick}
          @keydown=${this._onComboboxInputSpaceKeyDown}
        />
        <button
          aria-label="Open the list of options"
          class="combobox-button"
          type="button"
          @click=${this._onComboboxButtonClick}
          @keydown=${this._onComboboxButtonKeyDown}
          tabindex="-1"
        >
          ${Ie}
        </button>
      </div>
    `;
        }
        _renderSelectFace() {
          const t2 = this._opts.activeIndex > -1 ? `op-${this._opts.activeIndex}` : "", e2 = this.open ? "true" : "false";
          return U`
      <div
        aria-activedescendant=${Dt(this._opts.multiSelect ? void 0 : t2)}
        aria-controls="select-listbox"
        aria-expanded=${Dt(this._opts.multiSelect ? void 0 : e2)}
        aria-haspopup="listbox"
        aria-label=${Dt(this.label ?? void 0)}
        class="select-face face multiselect"
        @click=${this._onFaceClick}
        .tabIndex=${this.disabled ? -1 : 0}
      >
        ${this._renderLabel()} ${Ie}
      </div>
    `;
        }
        _renderDropdownControls() {
          return this._filteredOptions.length > 0 ? U`
          <div class="dropdown-controls">
            <button
              type="button"
              @click=${this._onMultiSelectAllClick}
              title="Select all"
              class="action-icon"
              id="select-all"
            >
              <vscode-icon name="checklist"></vscode-icon>
            </button>
            <button
              type="button"
              @click=${this._onMultiDeselectAllClick}
              title="Deselect all"
              class="action-icon"
              id="select-none"
            >
              <vscode-icon name="clear-all"></vscode-icon>
            </button>
            <vscode-button
              class="button-accept"
              @click=${this._onMultiAcceptClick}
              >OK</vscode-button
            >
          </div>
        ` : U`${q}`;
        }
        render() {
          return U`
      <div class="multi-select">
        <slot class="main-slot" @slotchange=${this._onSlotChange}></slot>
        ${this.combobox ? this._renderComboboxFace() : this._renderSelectFace()}
        ${this._renderDropdown()}
      </div>
    `;
        }
      };
      oi.styles = ii, oi.shadowRootOptions = { ...lt.shadowRootOptions, delegatesFocus: true }, oi.formAssociated = true, si([pt({ type: Array, attribute: "default-value" })], oi.prototype, "defaultValue", void 0), si([pt({ type: Boolean, reflect: true })], oi.prototype, "required", void 0), si([pt({ reflect: true })], oi.prototype, "name", void 0), si([pt({ type: Array, attribute: false })], oi.prototype, "selectedIndexes", null), si([pt({ type: Array })], oi.prototype, "value", null), si([ft(".face")], oi.prototype, "_faceElement", void 0), oi = si([$t("vscode-multi-select")], oi);
      ri = [_t, n`
    :host {
      display: block;
      height: 28px;
      margin: 0;
      outline: none;
      width: 28px;
    }

    .progress {
      height: 100%;
      width: 100%;
    }

    .background {
      fill: none;
      stroke: transparent;
      stroke-width: 2px;
    }

    .indeterminate-indicator-1 {
      fill: none;
      stroke: var(--vscode-progressBar-background, #0078d4);
      stroke-width: 2px;
      stroke-linecap: square;
      transform-origin: 50% 50%;
      transform: rotate(-90deg);
      transition: all 0.2s ease-in-out;
      animation: spin-infinite 2s linear infinite;
    }

    @keyframes spin-infinite {
      0% {
        stroke-dasharray: 0.01px 43.97px;
        transform: rotate(0deg);
      }
      50% {
        stroke-dasharray: 21.99px 21.99px;
        transform: rotate(450deg);
      }
      100% {
        stroke-dasharray: 0.01px 43.97px;
        transform: rotate(1080deg);
      }
    }
  `];
      ni = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      hi = class extends kt {
        constructor() {
          super(...arguments), this.ariaLabel = "Loading", this.ariaLive = "assertive", this.role = "alert";
        }
        render() {
          return U`<svg class="progress" part="progress" viewBox="0 0 16 16">
      <circle
        class="background"
        part="background"
        cx="8px"
        cy="8px"
        r="7px"
      ></circle>
      <circle
        class="indeterminate-indicator-1"
        part="indeterminate-indicator-1"
        cx="8px"
        cy="8px"
        r="7px"
      ></circle>
    </svg>`;
        }
      };
      hi.styles = ri, ni([pt({ reflect: true, attribute: "aria-label" })], hi.prototype, "ariaLabel", void 0), ni([pt({ reflect: true, attribute: "aria-live" })], hi.prototype, "ariaLive", void 0), ni([pt({ reflect: true })], hi.prototype, "role", void 0), hi = ni([$t("vscode-progress-ring")], hi);
      ai = [_t, n`
    :host {
      display: block;
      height: 2px;
      width: 100%;
      outline: none;
    }

    .container {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .track {
      position: absolute;
      inset: 0;
      background: transparent;
    }

    .indicator {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      height: 100%;
      background: var(--vscode-progressBar-background, #0078d4);
      will-change: transform, width, left;
    }

    /* Determinate mode: width is set inline via style attribute */
    .discrete .indicator {
      transition: width 100ms linear;
    }

    /* Indeterminate mode: VS Code style progress bit */
    .infinite .indicator {
      width: 2%;
      animation-name: progress;
      animation-duration: 4s;
      animation-iteration-count: infinite;
      animation-timing-function: linear;
      transform: translate3d(0px, 0px, 0px);
    }

    /* Long running: reduce GPU pressure using stepped animation */
    .infinite.infinite-long-running .indicator {
      animation-timing-function: steps(100);
    }

    /* Keyframes adapted from VS Code */
    @keyframes progress {
      from {
        transform: translateX(0%) scaleX(1);
      }
      50% {
        transform: translateX(2500%) scaleX(3);
      }
      to {
        transform: translateX(4900%) scaleX(1);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .discrete .indicator {
        transition: none;
      }
      .infinite .indicator,
      .infinite-long-running .indicator {
        animation: none;
        width: 100%;
      }
    }
  `];
      li = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      ci = class extends kt {
        constructor() {
          super(...arguments), this.ariaLabel = "Loading", this.max = 100, this.indeterminate = false, this.longRunningThreshold = 15e3, this._longRunning = false;
        }
        get _isDeterminate() {
          return !this.indeterminate && "number" == typeof this.value && isFinite(this.value);
        }
        connectedCallback() {
          super.connectedCallback(), this._maybeStartLongRunningTimer();
        }
        disconnectedCallback() {
          super.disconnectedCallback(), this._clearLongRunningTimer();
        }
        willUpdate() {
          this._maybeStartLongRunningTimer();
        }
        render() {
          const t2 = this.max > 0 ? this.max : 100, e2 = this._isDeterminate ? Math.min(Math.max(this.value ?? 0, 0), t2) : 0, i2 = this._isDeterminate ? e2 / t2 * 100 : 0, s2 = { container: true, discrete: this._isDeterminate, infinite: !this._isDeterminate, "infinite-long-running": this._longRunning && !this._isDeterminate };
          return U`
      <div
        class=${Mt(s2)}
        part="container"
        role="progressbar"
        aria-label=${this.ariaLabel}
        aria-valuemin="0"
        aria-valuemax=${String(t2)}
        aria-valuenow=${Dt(this._isDeterminate ? String(Math.round(e2)) : void 0)}
      >
        <div class="track" part="track"></div>
        <div
          class="indicator"
          part="indicator"
          .style=${Ft({ width: this._isDeterminate ? `${i2}%` : void 0 })}
        ></div>
      </div>
    `;
        }
        _maybeStartLongRunningTimer() {
          if (!(!this._isDeterminate && this.longRunningThreshold > 0 && this.isConnected)) return this._clearLongRunningTimer(), void (this._longRunning = false);
          this._longRunningHandle || (this._longRunningHandle = setTimeout((() => {
            this._longRunning = true, this._longRunningHandle = void 0, this.requestUpdate();
          }), this.longRunningThreshold));
        }
        _clearLongRunningTimer() {
          this._longRunningHandle && (clearTimeout(this._longRunningHandle), this._longRunningHandle = void 0);
        }
      };
      ci.styles = ai, li([pt({ reflect: true, attribute: "aria-label" })], ci.prototype, "ariaLabel", void 0), li([pt({ type: Number, reflect: true })], ci.prototype, "value", void 0), li([pt({ type: Number, reflect: true })], ci.prototype, "max", void 0), li([pt({ type: Boolean, reflect: true })], ci.prototype, "indeterminate", void 0), li([pt({ type: Number, attribute: "long-running-threshold" })], ci.prototype, "longRunningThreshold", void 0), li([vt()], ci.prototype, "_longRunning", void 0), ci = li([$t("vscode-progress-bar")], ci);
      di = [_t, Yt, n`
    :host(:invalid) .icon,
    :host([invalid]) .icon {
      background-color: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      border-color: var(--vscode-inputValidation-errorBorder, #be1100);
    }

    .icon {
      border-radius: 9px;
    }

    .icon.checked:before {
      background-color: currentColor;
      border-radius: 4px;
      content: '';
      height: 8px;
      left: 50%;
      margin: -4px 0 0 -4px;
      position: absolute;
      top: 50%;
      width: 8px;
    }

    :host(:focus):host(:not([disabled])) .icon {
      outline: 1px solid var(--vscode-focusBorder, #0078d4);
      outline-offset: -1px;
    }
  `];
      ui = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      pi = class extends Jt(Kt) {
        get form() {
          return this._internals.form;
        }
        get validity() {
          return this._internals.validity;
        }
        get validationMessage() {
          return this._internals.validationMessage;
        }
        get willValidate() {
          return this._internals.willValidate;
        }
        constructor() {
          super(), this.autofocus = false, this.checked = false, this.defaultChecked = false, this.invalid = false, this.name = "", this.type = "radio", this.value = "", this.disabled = false, this.required = false, this.tabIndex = 0, this._slottedText = "", this._handleClick = () => {
            this.disabled || this.checked || (this._checkButton(), this._handleValueChange(), this.dispatchEvent(new Event("change", { bubbles: true })));
          }, this._handleKeyDown = (t2) => {
            this.disabled || "Enter" !== t2.key && " " !== t2.key || (t2.preventDefault(), " " !== t2.key || this.checked || (this.checked = true, this._handleValueChange(), this.dispatchEvent(new Event("change", { bubbles: true }))), "Enter" === t2.key && this._internals.form?.requestSubmit());
          }, this._internals = this.attachInternals(), this.addEventListener("keydown", this._handleKeyDown), this.addEventListener("click", this._handleClick);
        }
        connectedCallback() {
          super.connectedCallback(), this._handleValueChange();
        }
        update(t2) {
          super.update(t2), t2.has("checked") && this._handleValueChange(), t2.has("required") && this._handleValueChange();
        }
        checkValidity() {
          return this._internals.checkValidity();
        }
        reportValidity() {
          return this._internals.reportValidity();
        }
        formResetCallback() {
          this._getRadios().forEach(((t2) => {
            t2.checked = t2.defaultChecked;
          })), this.updateComplete.then((() => {
            this._handleValueChange();
          }));
        }
        formStateRestoreCallback(t2, e2) {
          this.value === t2 && "" !== t2 && (this.checked = true);
        }
        setComponentValidity(t2) {
          t2 ? this._internals.setValidity({}) : this._internals.setValidity({ valueMissing: true }, "Please select one of these options.", this._inputEl);
        }
        _getRadios() {
          const t2 = this.getRootNode({ composed: false });
          if (!t2) return [];
          const e2 = t2.querySelectorAll(`vscode-radio[name="${this.name}"]`);
          return Array.from(e2);
        }
        _uncheckOthers(t2) {
          t2.forEach(((t3) => {
            t3 !== this && (t3.checked = false);
          }));
        }
        _checkButton() {
          const t2 = this._getRadios();
          this.checked = true, t2.forEach(((t3) => {
            t3 !== this && (t3.checked = false);
          }));
        }
        _setGroupValidity(t2, e2) {
          this.updateComplete.then((() => {
            t2.forEach(((t3) => {
              t3.setComponentValidity(e2);
            }));
          }));
        }
        _setActualFormValue() {
          let t2 = "";
          t2 = this.checked ? this.value ? this.value : "on" : null, this._internals.setFormValue(t2);
        }
        _handleValueChange() {
          const t2 = this._getRadios(), e2 = t2.some(((t3) => t3.required));
          if (this._setActualFormValue(), this.checked) this._uncheckOthers(t2), this._setGroupValidity(t2, true);
          else {
            const i2 = !!t2.find(((t3) => t3.checked)), s2 = e2 && !i2;
            this._setGroupValidity(t2, !s2);
          }
        }
        render() {
          const t2 = Mt({ icon: true, checked: this.checked }), e2 = Mt({ "label-inner": true, "is-slot-empty": "" === this._slottedText });
          return U`
      <div class="wrapper">
        <input
          ?autofocus=${this.autofocus}
          id="input"
          class="radio"
          type="checkbox"
          ?checked=${this.checked}
          value=${this.value}
          tabindex=${this.tabIndex}
        />
        <div class=${t2}></div>
        <label for="input" class="label" @click=${this._handleClick}>
          <span class=${e2}>
            ${this._renderLabelAttribute()}
            <slot @slotchange=${this._handleSlotChange}></slot>
          </span>
        </label>
      </div>
    `;
        }
      };
      pi.styles = di, pi.formAssociated = true, pi.shadowRootOptions = { ...lt.shadowRootOptions, delegatesFocus: true }, ui([pt({ type: Boolean, reflect: true })], pi.prototype, "autofocus", void 0), ui([pt({ type: Boolean, reflect: true })], pi.prototype, "checked", void 0), ui([pt({ type: Boolean, reflect: true, attribute: "default-checked" })], pi.prototype, "defaultChecked", void 0), ui([pt({ type: Boolean, reflect: true })], pi.prototype, "invalid", void 0), ui([pt({ reflect: true })], pi.prototype, "name", void 0), ui([pt()], pi.prototype, "type", void 0), ui([pt()], pi.prototype, "value", void 0), ui([pt({ type: Boolean, reflect: true })], pi.prototype, "disabled", void 0), ui([pt({ type: Boolean, reflect: true })], pi.prototype, "required", void 0), ui([pt({ type: Number, reflect: true })], pi.prototype, "tabIndex", void 0), ui([vt()], pi.prototype, "_slottedText", void 0), ui([ft("#input")], pi.prototype, "_inputEl", void 0), pi = ui([$t("vscode-radio")], pi);
      vi = [_t, n`
    :host {
      display: block;
    }

    .wrapper {
      display: flex;
      flex-wrap: wrap;
    }

    :host([variant='vertical']) .wrapper {
      display: block;
    }

    ::slotted(vscode-radio) {
      margin-right: 20px;
    }

    ::slotted(vscode-radio:last-child) {
      margin-right: 0;
    }

    :host([variant='vertical']) ::slotted(vscode-radio) {
      display: block;
      margin-bottom: 15px;
    }

    :host([variant='vertical']) ::slotted(vscode-radio:last-child) {
      margin-bottom: 0;
    }
  `];
      bi = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      fi = class extends kt {
        constructor() {
          super(), this.variant = "horizontal", this.role = "radiogroup", this._focusedRadio = -1, this._checkedRadio = -1, this._firstContentLoaded = false, this._handleKeyDown = (t2) => {
            const { key: e2 } = t2;
            ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(e2) && t2.preventDefault(), "ArrowRight" !== e2 && "ArrowDown" !== e2 || this._checkNext(), "ArrowLeft" !== e2 && "ArrowUp" !== e2 || this._checkPrev();
          }, this.addEventListener("keydown", this._handleKeyDown);
        }
        _uncheckPreviousChecked(t2, e2) {
          -1 !== t2 && (this._radios[t2].checked = false), -1 !== e2 && (this._radios[e2].tabIndex = -1);
        }
        _afterCheck() {
          this._focusedRadio = this._checkedRadio, this._radios[this._checkedRadio].checked = true, this._radios[this._checkedRadio].tabIndex = 0, this._radios[this._checkedRadio].focus();
        }
        _checkPrev() {
          const t2 = this._radios.findIndex(((t3) => t3.checked)), e2 = this._radios.findIndex(((t3) => t3.focused)), i2 = -1 !== e2 ? e2 : t2;
          this._uncheckPreviousChecked(t2, e2), this._checkedRadio = -1 === i2 ? this._radios.length - 1 : i2 - 1 >= 0 ? i2 - 1 : this._radios.length - 1, this._afterCheck();
        }
        _checkNext() {
          const t2 = this._radios.findIndex(((t3) => t3.checked)), e2 = this._radios.findIndex(((t3) => t3.focused)), i2 = -1 !== e2 ? e2 : t2;
          this._uncheckPreviousChecked(t2, e2), -1 === i2 ? this._checkedRadio = 0 : i2 + 1 < this._radios.length ? this._checkedRadio = i2 + 1 : this._checkedRadio = 0, this._afterCheck();
        }
        _handleChange(t2) {
          const e2 = this._radios.findIndex(((e3) => e3 === t2.target));
          -1 !== e2 && (-1 !== this._focusedRadio && (this._radios[this._focusedRadio].tabIndex = -1), -1 !== this._checkedRadio && this._checkedRadio !== e2 && (this._radios[this._checkedRadio].checked = false), this._focusedRadio = e2, this._checkedRadio = e2, this._radios[e2].tabIndex = 0);
        }
        _handleSlotChange() {
          if (!this._firstContentLoaded) {
            const t3 = this._radios.findIndex(((t4) => t4.autofocus));
            t3 > -1 && (this._focusedRadio = t3), this._firstContentLoaded = true;
          }
          let t2 = -1;
          this._radios.forEach(((e2, i2) => {
            this._focusedRadio > -1 ? e2.tabIndex = i2 === this._focusedRadio ? 0 : -1 : e2.tabIndex = 0 === i2 ? 0 : -1, e2.defaultChecked && (t2 > -1 && (this._radios[t2].defaultChecked = false), t2 = i2);
          })), t2 > -1 && (this._radios[t2].checked = true);
        }
        render() {
          return U`
      <div class="wrapper">
        <slot
          @slotchange=${this._handleSlotChange}
          @change=${this._handleChange}
        ></slot>
      </div>
    `;
        }
      };
      fi.styles = vi, bi([pt({ reflect: true })], fi.prototype, "variant", void 0), bi([pt({ reflect: true })], fi.prototype, "role", void 0), bi([mt({ selector: "vscode-radio" })], fi.prototype, "_radios", void 0), bi([vt()], fi.prototype, "_focusedRadio", void 0), bi([vt()], fi.prototype, "_checkedRadio", void 0), fi = bi([$t("vscode-radio-group")], fi);
      gi = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      mi = class extends ei {
        set selectedIndex(t2) {
          this._opts.selectedIndex = t2;
          const e2 = this._opts.getOptionByIndex(t2);
          e2 ? (this._opts.activeIndex = t2, this._value = e2.value, this._internals.setFormValue(this._value), this._manageRequired()) : (this._value = "", this._internals.setFormValue(""), this._manageRequired());
        }
        get selectedIndex() {
          return this._opts.selectedIndex;
        }
        set value(t2) {
          this._opts.value = t2, this._opts.selectedIndex > -1 ? this._requestedValueToSetLater = "" : this._requestedValueToSetLater = t2, this._internals.setFormValue(this._value), this._manageRequired();
        }
        get value() {
          return this._opts.value;
        }
        get validity() {
          return this._internals.validity;
        }
        get validationMessage() {
          return this._internals.validationMessage;
        }
        get willValidate() {
          return this._internals.willValidate;
        }
        checkValidity() {
          return this._internals.checkValidity();
        }
        reportValidity() {
          return this._internals.reportValidity();
        }
        updateInputValue() {
          if (!this.combobox) return;
          const t2 = this.renderRoot.querySelector(".combobox-input");
          if (t2) {
            const e2 = this._opts.getSelectedOption();
            t2.value = e2?.label ?? "";
          }
        }
        constructor() {
          super(), this.defaultValue = "", this.name = void 0, this.required = false, this._requestedValueToSetLater = "", this._opts.multiSelect = false, this._internals = this.attachInternals();
        }
        connectedCallback() {
          super.connectedCallback(), this.updateComplete.then((() => {
            this._manageRequired();
          }));
        }
        formResetCallback() {
          this.value = this.defaultValue;
        }
        formStateRestoreCallback(t2, e2) {
          this.updateComplete.then((() => {
            this.value = t2;
          }));
        }
        get type() {
          return "select-one";
        }
        get form() {
          return this._internals.form;
        }
        async _createAndSelectSuggestedOption() {
          const t2 = this._createSuggestedOption();
          await this.updateComplete, this._opts.selectedIndex = t2, this._dispatchChangeEvent();
          const e2 = new CustomEvent("vsc-single-select-create-option", { detail: { value: this._opts.getOptionByIndex(t2)?.value ?? "" } });
          this.dispatchEvent(e2), this.open = false, this._isPlaceholderOptionActive = false;
        }
        _setStateFromSlottedElements() {
          super._setStateFromSlottedElements(), this.combobox || 0 !== this._opts.selectedIndexes.length || (this._opts.selectedIndex = this._opts.options.length > 0 ? 0 : -1);
        }
        _onSlotChange() {
          if (super._onSlotChange(), this._requestedValueToSetLater) {
            const t2 = this._opts.getOptionByValue(this._requestedValueToSetLater);
            t2 && (this._opts.selectedIndex = t2.index, this._requestedValueToSetLater = "");
          }
          this._opts.selectedIndex > -1 && this._opts.numOptions > 0 ? (this._internals.setFormValue(this._opts.value), this._manageRequired()) : (this._internals.setFormValue(null), this._manageRequired());
        }
        _onEnterKeyDown(t2) {
          super._onEnterKeyDown(t2);
          let e2 = false;
          this.combobox ? this.open ? this._isPlaceholderOptionActive ? this._createAndSelectSuggestedOption() : (e2 = this._opts.activeIndex !== this._opts.selectedIndex, this._opts.selectedIndex = this._opts.activeIndex, this.open = false) : (this.open = true, this._scrollActiveElementToTop()) : this.open ? (e2 = this._opts.activeIndex !== this._opts.selectedIndex, this._opts.selectedIndex = this._opts.activeIndex, this.open = false) : (this.open = true, this._scrollActiveElementToTop()), e2 && (this._dispatchChangeEvent(), this.updateInputValue(), this._internals.setFormValue(this._opts.value), this._manageRequired());
        }
        _onOptionClick(t2) {
          super._onOptionClick(t2);
          const e2 = t2.composedPath().find(((t3) => {
            if ("matches" in t3) return t3.matches("li.option");
          }));
          if (!e2 || e2.matches(".disabled")) return;
          e2.classList.contains("placeholder") ? this.creatable && this._createAndSelectSuggestedOption() : (this._opts.selectedIndex = Number(e2.dataset.index), this.open = false, this._internals.setFormValue(this._opts.value), this._manageRequired(), this._dispatchChangeEvent());
        }
        _manageRequired() {
          const { value: t2 } = this;
          "" === t2 && this.required ? this._internals.setValidity({ valueMissing: true }, "Please select an item in the list.", this._face) : this._internals.setValidity({});
        }
        _renderSelectFace() {
          const t2 = this._opts.getSelectedOption(), e2 = t2?.label ?? "", i2 = this._opts.activeIndex > -1 ? `op-${this._opts.activeIndex}` : "";
          return U`
      <div
        aria-activedescendant=${i2}
        aria-controls="select-listbox"
        aria-expanded=${this.open ? "true" : "false"}
        aria-haspopup="listbox"
        aria-label=${Dt(this.label)}
        class="select-face face"
        @click=${this._onFaceClick}
        role="combobox"
        tabindex="0"
      >
        <span class="text">${e2}</span> ${Ie}
      </div>
    `;
        }
        _renderComboboxFace() {
          let t2 = "";
          if (this._isBeingFiltered) t2 = this._opts.filterPattern;
          else {
            const e3 = this._opts.getSelectedOption();
            t2 = e3?.label ?? "";
          }
          const e2 = this._opts.activeIndex > -1 ? `op-${this._opts.activeIndex}` : "", i2 = this.open ? "true" : "false";
          return U`
      <div class="combobox-face face">
        <input
          aria-activedescendant=${e2}
          aria-autocomplete="list"
          aria-controls="select-listbox"
          aria-expanded=${i2}
          aria-haspopup="listbox"
          aria-label=${Dt(this.label)}
          class="combobox-input"
          role="combobox"
          spellcheck="false"
          type="text"
          autocomplete="off"
          .value=${t2}
          @focus=${this._onComboboxInputFocus}
          @blur=${this._onComboboxInputBlur}
          @input=${this._onComboboxInputInput}
          @click=${this._onComboboxInputClick}
          @keydown=${this._onComboboxInputSpaceKeyDown}
        />
        <button
          aria-label="Open the list of options"
          class="combobox-button"
          type="button"
          @click=${this._onComboboxButtonClick}
          @keydown=${this._onComboboxButtonKeyDown}
          tabindex="-1"
        >
          ${Ie}
        </button>
      </div>
    `;
        }
        render() {
          return U`
      <div class="single-select">
        <slot class="main-slot" @slotchange=${this._onSlotChange}></slot>
        ${this.combobox ? this._renderComboboxFace() : this._renderSelectFace()}
        ${this._renderDropdown()}
      </div>
    `;
        }
      };
      mi.styles = ii, mi.shadowRootOptions = { ...lt.shadowRootOptions, delegatesFocus: true }, mi.formAssociated = true, gi([pt({ attribute: "default-value" })], mi.prototype, "defaultValue", void 0), gi([pt({ reflect: true })], mi.prototype, "name", void 0), gi([pt({ type: Number, attribute: "selected-index" })], mi.prototype, "selectedIndex", null), gi([pt({ type: String })], mi.prototype, "value", null), gi([pt({ type: Boolean, reflect: true })], mi.prototype, "required", void 0), gi([ft(".face")], mi.prototype, "_face", void 0), mi = gi([$t("vscode-single-select")], mi);
      xi = [_t, n`
    :host {
      --separator-border: var(--vscode-editorWidget-border, #454545);

      border: 1px solid var(--vscode-editorWidget-border, #454545);
      display: block;
      overflow: hidden;
      position: relative;
    }

    ::slotted(*) {
      height: 100%;
      width: 100%;
    }

    ::slotted(vscode-split-layout) {
      border: 0;
    }

    .wrapper {
      display: flex;
      height: 100%;
      width: 100%;
    }

    .wrapper.horizontal {
      flex-direction: column;
    }

    .start {
      box-sizing: border-box;
      flex: 1;
      min-height: 0;
      min-width: 0;
    }

    :host([split='vertical']) .start {
      border-right: 1px solid var(--separator-border);
    }

    :host([split='horizontal']) .start {
      border-bottom: 1px solid var(--separator-border);
    }

    .end {
      flex: 1;
      min-height: 0;
      min-width: 0;
    }

    :host([split='vertical']) .start,
    :host([split='vertical']) .end {
      height: 100%;
    }

    :host([split='horizontal']) .start,
    :host([split='horizontal']) .end {
      width: 100%;
    }

    .handle-overlay {
      display: none;
      height: 100%;
      left: 0;
      position: absolute;
      top: 0;
      width: 100%;
      z-index: 1;
    }

    .handle-overlay.active {
      display: block;
    }

    .handle-overlay.split-vertical {
      cursor: ew-resize;
    }

    .handle-overlay.split-horizontal {
      cursor: ns-resize;
    }

    .handle {
      background-color: transparent;
      position: absolute;
      z-index: 2;
    }

    .handle.hover {
      transition: background-color 0.1s ease-out 0.3s;
      background-color: var(--vscode-sash-hoverBorder, #0078d4);
    }

    .handle.hide {
      background-color: transparent;
      transition: background-color 0.1s ease-out;
    }

    .handle.split-vertical {
      cursor: ew-resize;
      height: 100%;
    }

    .handle.split-horizontal {
      cursor: ns-resize;
      width: 100%;
    }
  `];
      yi = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      ki = (t2) => {
        if (!t2) return { value: 0, unit: "pixel" };
        let e2, i2;
        t2.endsWith("%") ? (e2 = "percent", i2 = +t2.substring(0, t2.length - 1)) : t2.endsWith("px") ? (e2 = "pixel", i2 = +t2.substring(0, t2.length - 2)) : (e2 = "pixel", i2 = +t2);
        return { unit: e2, value: isNaN(i2) ? 0 : i2 };
      };
      $i = (t2, e2) => 0 === e2 ? 0 : Math.min(100, t2 / e2 * 100);
      _i = (t2, e2) => e2 * (t2 / 100);
      Si = wi = class extends kt {
        set split(t2) {
          this._split !== t2 && (this._split = t2, this.resetHandlePosition());
        }
        get split() {
          return this._split;
        }
        set handlePosition(t2) {
          this._rawHandlePosition = t2, this._handlePositionPropChanged();
        }
        get handlePosition() {
          return this._rawHandlePosition;
        }
        set fixedPane(t2) {
          this._fixedPane = t2, this._fixedPanePropChanged();
        }
        get fixedPane() {
          return this._fixedPane;
        }
        set minStart(t2) {
          const e2 = t2 ?? void 0;
          this._minStart !== e2 && (this._minStart = e2, this._applyMinSizeConstraints());
        }
        get minStart() {
          return this._minStart;
        }
        set minEnd(t2) {
          const e2 = t2 ?? void 0;
          this._minEnd !== e2 && (this._minEnd = e2, this._applyMinSizeConstraints());
        }
        get minEnd() {
          return this._minEnd;
        }
        constructor() {
          super(), this._split = "vertical", this.resetOnDblClick = false, this.handleSize = 4, this.initialHandlePosition = "50%", this._fixedPane = "none", this._handlePosition = 0, this._isDragActive = false, this._hover = false, this._hide = false, this._boundRect = new DOMRect(), this._handleOffset = 0, this._wrapperObserved = false, this._fixedPaneSize = 0, this._handleResize = (t2) => {
            const e2 = t2[0].contentRect, { width: i2, height: s2 } = e2;
            this._boundRect = e2;
            const o2 = "vertical" === this.split ? i2 : s2;
            "start" === this.fixedPane && (this._handlePosition = this._fixedPaneSize), "end" === this.fixedPane && (this._handlePosition = o2 - this._fixedPaneSize), this._handlePosition = this._clampHandlePosition(this._handlePosition, o2), this._updateFixedPaneSize(o2);
          }, this._handleMouseUp = (t2) => {
            this._isDragActive = false, t2.target !== this && (this._hover = false, this._hide = true), window.removeEventListener("mouseup", this._handleMouseUp), window.removeEventListener("mousemove", this._handleMouseMove);
            const { width: e2, height: i2 } = this._boundRect, s2 = "vertical" === this.split ? e2 : i2, o2 = $i(this._handlePosition, s2);
            this.dispatchEvent(new CustomEvent("vsc-split-layout-change", { detail: { position: this._handlePosition, positionInPercentage: o2 }, composed: true }));
          }, this._handleMouseMove = (t2) => {
            const { clientX: e2, clientY: i2 } = t2, { left: s2, top: o2, height: r2, width: n2 } = this._boundRect, h2 = "vertical" === this.split, a2 = h2 ? n2 : r2, l2 = (h2 ? e2 - s2 : i2 - o2) - this._handleOffset + this.handleSize / 2;
            this._handlePosition = this._clampHandlePosition(l2, a2), this._updateFixedPaneSize(a2);
          }, this._resizeObserver = new ResizeObserver(this._handleResize);
        }
        resetHandlePosition() {
          if (!this._wrapperEl) return void (this._handlePosition = 0);
          const { width: t2, height: e2 } = this._wrapperEl.getBoundingClientRect(), i2 = "vertical" === this.split ? t2 : e2, { value: s2, unit: o2 } = ki(this.initialHandlePosition ?? "50%"), r2 = "percent" === o2 ? _i(s2, i2) : s2;
          this._handlePosition = this._clampHandlePosition(r2, i2), this._updateFixedPaneSize(i2);
        }
        connectedCallback() {
          super.connectedCallback();
        }
        firstUpdated(t2) {
          "none" !== this.fixedPane && (this._resizeObserver.observe(this._wrapperEl), this._wrapperObserved = true), this._boundRect = this._wrapperEl.getBoundingClientRect();
          const { value: e2, unit: i2 } = this.handlePosition ? ki(this.handlePosition) : ki(this.initialHandlePosition);
          this._setPosition(e2, i2), this._initFixedPane();
        }
        _handlePositionPropChanged() {
          if (this.handlePosition && this._wrapperEl) {
            this._boundRect = this._wrapperEl.getBoundingClientRect();
            const { value: t2, unit: e2 } = ki(this.handlePosition);
            this._setPosition(t2, e2);
          }
        }
        _fixedPanePropChanged() {
          this._wrapperEl && this._initFixedPane();
        }
        _initFixedPane() {
          if ("none" === this.fixedPane) this._wrapperObserved && (this._resizeObserver.unobserve(this._wrapperEl), this._wrapperObserved = false);
          else {
            const { width: t2, height: e2 } = this._boundRect, i2 = "vertical" === this.split ? t2 : e2;
            this._fixedPaneSize = "start" === this.fixedPane ? this._handlePosition : i2 - this._handlePosition, this._wrapperObserved || (this._resizeObserver.observe(this._wrapperEl), this._wrapperObserved = true);
          }
        }
        _applyMinSizeConstraints() {
          if (!this._wrapperEl) return;
          this._boundRect = this._wrapperEl.getBoundingClientRect();
          const { width: t2, height: e2 } = this._boundRect, i2 = "vertical" === this.split ? t2 : e2;
          this._handlePosition = this._clampHandlePosition(this._handlePosition, i2), this._updateFixedPaneSize(i2);
        }
        _resolveMinSizePx(t2, e2) {
          if (!t2) return 0;
          const { unit: i2, value: s2 } = ki(t2), o2 = "percent" === i2 ? _i(s2, e2) : s2;
          return isFinite(o2) ? Math.max(0, Math.min(o2, e2)) : 0;
        }
        _clampHandlePosition(t2, e2) {
          if (!isFinite(e2) || e2 <= 0) return 0;
          const i2 = this._resolveMinSizePx(this._minStart, e2), s2 = this._resolveMinSizePx(this._minEnd, e2), o2 = Math.min(i2, e2), r2 = Math.max(o2, e2 - s2), n2 = Math.max(o2, Math.min(t2, r2));
          return Math.max(0, Math.min(n2, e2));
        }
        _updateFixedPaneSize(t2) {
          "start" === this.fixedPane ? this._fixedPaneSize = this._handlePosition : "end" === this.fixedPane && (this._fixedPaneSize = t2 - this._handlePosition);
        }
        _setPosition(t2, e2) {
          const { width: i2, height: s2 } = this._boundRect, o2 = "vertical" === this.split ? i2 : s2, r2 = "percent" === e2 ? _i(t2, o2) : t2;
          this._handlePosition = this._clampHandlePosition(r2, o2), this._updateFixedPaneSize(o2);
        }
        _handleMouseOver() {
          this._hover = true, this._hide = false;
        }
        _handleMouseOut(t2) {
          1 !== t2.buttons && (this._hover = false, this._hide = true);
        }
        _handleMouseDown(t2) {
          t2.stopPropagation(), t2.preventDefault(), this._boundRect = this._wrapperEl.getBoundingClientRect();
          const { left: e2, top: i2 } = this._boundRect, { left: s2, top: o2 } = this._handleEl.getBoundingClientRect(), r2 = t2.clientX - e2, n2 = t2.clientY - i2;
          "vertical" === this.split && (this._handleOffset = r2 - (s2 - e2)), "horizontal" === this.split && (this._handleOffset = n2 - (o2 - i2)), this._isDragActive = true, window.addEventListener("mouseup", this._handleMouseUp), window.addEventListener("mousemove", this._handleMouseMove);
        }
        _handleDblClick() {
          this.resetOnDblClick && this.resetHandlePosition();
        }
        _handleSlotChange() {
          [...this._nestedLayoutsAtStart, ...this._nestedLayoutsAtEnd].forEach(((t2) => {
            t2 instanceof wi && t2.resetHandlePosition();
          }));
        }
        render() {
          const { width: t2, height: e2 } = this._boundRect, i2 = "vertical" === this.split ? t2 : e2, s2 = "none" !== this.fixedPane ? `${this._handlePosition}px` : `${$i(this._handlePosition, i2)}%`;
          let o2 = "";
          o2 = "start" === this.fixedPane ? `0 0 ${this._fixedPaneSize}px` : `1 1 ${$i(this._handlePosition, i2)}%`;
          let r2 = "";
          r2 = "end" === this.fixedPane ? `0 0 ${this._fixedPaneSize}px` : `1 1 ${$i(i2 - this._handlePosition, i2)}%`;
          const n2 = { left: "vertical" === this.split ? s2 : "0", top: "vertical" === this.split ? "0" : s2 }, h2 = this.handleSize ?? 4;
          "vertical" === this.split && (n2.marginLeft = 0 - h2 / 2 + "px", n2.width = `${h2}px`), "horizontal" === this.split && (n2.height = `${h2}px`, n2.marginTop = 0 - h2 / 2 + "px");
          const a2 = Mt({ "handle-overlay": true, active: this._isDragActive, "split-vertical": "vertical" === this.split, "split-horizontal": "horizontal" === this.split }), l2 = Mt({ handle: true, hover: this._hover, hide: this._hide, "split-vertical": "vertical" === this.split, "split-horizontal": "horizontal" === this.split }), c2 = { wrapper: true, horizontal: "horizontal" === this.split };
          return U`
      <div class=${Mt(c2)}>
        <div class="start" .style=${Ft({ flex: o2 })}>
          <slot name="start" @slotchange=${this._handleSlotChange}></slot>
        </div>
        <div class="end" .style=${Ft({ flex: r2 })}>
          <slot name="end" @slotchange=${this._handleSlotChange}></slot>
        </div>
        <div class=${a2}></div>
        <div
          class=${l2}
          .style=${Ft(n2)}
          @mouseover=${this._handleMouseOver}
          @mouseout=${this._handleMouseOut}
          @mousedown=${this._handleMouseDown}
          @dblclick=${this._handleDblClick}
        ></div>
      </div>
    `;
        }
      };
      Si.styles = xi, yi([pt({ reflect: true })], Si.prototype, "split", null), yi([pt({ type: Boolean, reflect: true, attribute: "reset-on-dbl-click" })], Si.prototype, "resetOnDblClick", void 0), yi([pt({ type: Number, reflect: true, attribute: "handle-size" })], Si.prototype, "handleSize", void 0), yi([pt({ reflect: true, attribute: "initial-handle-position" })], Si.prototype, "initialHandlePosition", void 0), yi([pt({ attribute: "handle-position" })], Si.prototype, "handlePosition", null), yi([pt({ attribute: "fixed-pane" })], Si.prototype, "fixedPane", null), yi([pt({ attribute: "min-start" })], Si.prototype, "minStart", null), yi([pt({ attribute: "min-end" })], Si.prototype, "minEnd", null), yi([vt()], Si.prototype, "_handlePosition", void 0), yi([vt()], Si.prototype, "_isDragActive", void 0), yi([vt()], Si.prototype, "_hover", void 0), yi([vt()], Si.prototype, "_hide", void 0), yi([ft(".wrapper")], Si.prototype, "_wrapperEl", void 0), yi([ft(".handle")], Si.prototype, "_handleEl", void 0), yi([mt({ slot: "start", selector: "vscode-split-layout" })], Si.prototype, "_nestedLayoutsAtStart", void 0), yi([mt({ slot: "end", selector: "vscode-split-layout" })], Si.prototype, "_nestedLayoutsAtEnd", void 0), Si = wi = yi([$t("vscode-split-layout")], Si);
      Ci = [_t, n`
    :host {
      cursor: pointer;
      display: block;
      user-select: none;
    }

    .wrapper {
      align-items: center;
      border-bottom: 1px solid transparent;
      color: var(--vscode-foreground, #cccccc);
      display: flex;
      min-height: 20px;
      overflow: hidden;
      padding: 7px 8px;
      position: relative;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :host([active]) .wrapper {
      border-bottom-color: var(--vscode-panelTitle-activeForeground, #cccccc);
      color: var(--vscode-panelTitle-activeForeground, #cccccc);
    }

    :host([panel]) .wrapper {
      border-bottom: 0;
      margin-bottom: 0;
      padding: 0;
    }

    :host(:focus-visible) {
      outline: none;
    }

    .wrapper {
      align-items: center;
      color: var(--vscode-foreground, #cccccc);
      display: flex;
      min-height: 20px;
      overflow: inherit;
      text-overflow: inherit;
      position: relative;
    }

    .wrapper.panel {
      color: var(--vscode-panelTitle-inactiveForeground, #9d9d9d);
    }

    .wrapper.panel.active,
    .wrapper.panel:hover {
      color: var(--vscode-panelTitle-activeForeground, #cccccc);
    }

    :host([panel]) .wrapper {
      display: flex;
      font-size: 11px;
      height: 31px;
      padding: 2px 10px;
      text-transform: uppercase;
    }

    .main {
      overflow: inherit;
      text-overflow: inherit;
    }

    .active-indicator {
      display: none;
    }

    .active-indicator.panel.active {
      border-top: 1px solid var(--vscode-panelTitle-activeBorder, #0078d4);
      bottom: 4px;
      display: block;
      left: 8px;
      pointer-events: none;
      position: absolute;
      right: 8px;
    }

    :host(:focus-visible) .wrapper {
      outline-color: var(--vscode-focusBorder, #0078d4);
      outline-offset: 3px;
      outline-style: solid;
      outline-width: 1px;
    }

    :host(:focus-visible) .wrapper.panel {
      outline-offset: -2px;
    }

    slot[name='content-before']::slotted(vscode-badge) {
      margin-right: 8px;
    }

    slot[name='content-after']::slotted(vscode-badge) {
      margin-left: 8px;
    }
  `];
      Bi = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      Ai = class extends kt {
        constructor() {
          super(...arguments), this.active = false, this.ariaControls = "", this.panel = false, this.role = "tab", this.tabId = -1;
        }
        attributeChangedCallback(t2, e2, i2) {
          if (super.attributeChangedCallback(t2, e2, i2), "active" === t2) {
            const t3 = null !== i2;
            this.ariaSelected = t3 ? "true" : "false", this.tabIndex = t3 ? 0 : -1;
          }
        }
        render() {
          return U`
      <div
        class=${Mt({ wrapper: true, active: this.active, panel: this.panel })}
      >
        <div class="before"><slot name="content-before"></slot></div>
        <div class="main"><slot></slot></div>
        <div class="after"><slot name="content-after"></slot></div>
        <span
          class=${Mt({ "active-indicator": true, active: this.active, panel: this.panel })}
        ></span>
      </div>
    `;
        }
      };
      Ai.styles = Ci, Bi([pt({ type: Boolean, reflect: true })], Ai.prototype, "active", void 0), Bi([pt({ reflect: true, attribute: "aria-controls" })], Ai.prototype, "ariaControls", void 0), Bi([pt({ type: Boolean, reflect: true })], Ai.prototype, "panel", void 0), Bi([pt({ reflect: true })], Ai.prototype, "role", void 0), Bi([pt({ type: Number, reflect: true, attribute: "tab-id" })], Ai.prototype, "tabId", void 0), Ai = Bi([$t("vscode-tab-header")], Ai);
      Oi = [_t, n`
    :host {
      display: block;
      overflow: hidden;
    }

    :host(:focus-visible) {
      outline-color: var(--vscode-focusBorder, #0078d4);
      outline-offset: 3px;
      outline-style: solid;
      outline-width: 1px;
    }

    :host([panel]) {
      background-color: var(--vscode-panel-background, #181818);
    }
  `];
      zi = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      Ei = class extends kt {
        constructor() {
          super(...arguments), this.hidden = false, this.ariaLabelledby = "", this.panel = false, this.role = "tabpanel", this.tabIndex = 0;
        }
        render() {
          return U` <slot></slot> `;
        }
      };
      Ei.styles = Oi, zi([pt({ type: Boolean, reflect: true })], Ei.prototype, "hidden", void 0), zi([pt({ reflect: true, attribute: "aria-labelledby" })], Ei.prototype, "ariaLabelledby", void 0), zi([pt({ type: Boolean, reflect: true })], Ei.prototype, "panel", void 0), zi([pt({ reflect: true })], Ei.prototype, "role", void 0), zi([pt({ type: Number, reflect: true })], Ei.prototype, "tabIndex", void 0), Ei = zi([$t("vscode-tab-panel")], Ei);
      Ii = [_t, n`
    :host {
      display: table;
      table-layout: fixed;
      width: 100%;
    }

    ::slotted(vscode-table-row:nth-child(even)) {
      background-color: var(--vsc-row-even-background);
    }

    ::slotted(vscode-table-row:nth-child(odd)) {
      background-color: var(--vsc-row-odd-background);
    }
  `];
      ji = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      Mi = class extends kt {
        constructor() {
          super(...arguments), this.role = "rowgroup";
        }
        render() {
          return U` <slot></slot> `;
        }
      };
      Mi.styles = Ii, ji([pt({ reflect: true })], Mi.prototype, "role", void 0), Mi = ji([$t("vscode-table-body")], Mi);
      Di = [_t, n`
    :host {
      border-bottom-color: var(
        --vscode-editorGroup-border,
        rgba(255, 255, 255, 0.09)
      );
      border-bottom-style: solid;
      border-bottom-width: var(--vsc-row-border-bottom-width);
      box-sizing: border-box;
      color: var(--vscode-foreground, #cccccc);
      display: table-cell;
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      height: 24px;
      overflow: hidden;
      padding-left: 10px;
      text-overflow: ellipsis;
      vertical-align: middle;
      white-space: nowrap;
    }

    :host([compact]) {
      display: block;
      height: auto;
      padding-bottom: 5px;
      width: 100% !important;
    }

    :host([compact]:first-child) {
      padding-top: 10px;
    }

    :host([compact]:last-child) {
      padding-bottom: 10px;
    }

    .wrapper {
      overflow: inherit;
      text-overflow: inherit;
      white-space: inherit;
      width: 100%;
    }

    .column-label {
      font-weight: bold;
    }
  `];
      Fi = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      Pi = class extends kt {
        constructor() {
          super(...arguments), this.role = "cell", this.columnLabel = "", this.compact = false;
        }
        render() {
          const t2 = this.columnLabel ? U`<div class="column-label" role="presentation">
          ${this.columnLabel}
        </div>` : q;
          return U`
      <div class="wrapper">
        ${t2}
        <slot></slot>
      </div>
    `;
        }
      };
      Pi.styles = Di, Fi([pt({ reflect: true })], Pi.prototype, "role", void 0), Fi([pt({ attribute: "column-label" })], Pi.prototype, "columnLabel", void 0), Fi([pt({ type: Boolean, reflect: true })], Pi.prototype, "compact", void 0), Pi = Fi([$t("vscode-table-cell")], Pi);
      Vi = [_t, n`
    :host {
      background-color: var(
        --vscode-keybindingTable-headerBackground,
        rgba(204, 204, 204, 0.04)
      );
      display: table;
      table-layout: fixed;
      width: 100%;
    }
  `];
      Ni = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      Ti = class extends kt {
        constructor() {
          super(...arguments), this.role = "rowgroup";
        }
        render() {
          return U` <slot></slot> `;
        }
      };
      Ti.styles = Vi, Ni([pt({ reflect: true })], Ti.prototype, "role", void 0), Ti = Ni([$t("vscode-table-header")], Ti);
      Ri = [_t, n`
    :host {
      box-sizing: border-box;
      color: var(--vscode-foreground, #cccccc);
      display: table-cell;
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      font-weight: bold;
      line-height: 20px;
      overflow: hidden;
      padding-bottom: 5px;
      padding-left: 10px;
      padding-right: 0;
      padding-top: 5px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .wrapper {
      box-sizing: inherit;
      overflow: inherit;
      text-overflow: inherit;
      white-space: inherit;
      width: 100%;
    }
  `];
      Li = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      Ui = class extends kt {
        constructor() {
          super(...arguments), this.minWidth = "0", this.index = -1, this.role = "columnheader";
        }
        willUpdate(t2) {
          t2.has("minWidth") && this.index > -1 && this.dispatchEvent(new CustomEvent("vsc-table-change-min-column-width", { detail: { columnIndex: this.index, propertyValue: this.minWidth }, bubbles: true }));
        }
        render() {
          return U`
      <div class="wrapper">
        <slot></slot>
      </div>
    `;
        }
      };
      Ui.styles = Ri, Li([pt({ attribute: "min-width" })], Ui.prototype, "minWidth", void 0), Li([pt({ type: Number })], Ui.prototype, "index", void 0), Li([pt({ reflect: true })], Ui.prototype, "role", void 0), Ui = Li([$t("vscode-table-header-cell")], Ui);
      Hi = [_t, n`
    :host {
      border-top-color: var(
        --vscode-editorGroup-border,
        rgba(255, 255, 255, 0.09)
      );
      border-top-style: solid;
      border-top-width: var(--vsc-row-border-top-width);
      display: var(--vsc-row-display);
      width: 100%;
    }
  `];
      Gi = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      qi = class extends kt {
        constructor() {
          super(...arguments), this.role = "row";
        }
        render() {
          return U` <slot></slot> `;
        }
      };
      qi.styles = Hi, Gi([pt({ reflect: true })], qi.prototype, "role", void 0), qi = Gi([$t("vscode-table-row")], qi);
      Wi = [{ test: (t2) => /^-?\d+(\.\d+)?%$/.test(t2), parse: (t2) => Number(t2.slice(0, -1)) }, { test: (t2) => /^-?\d+(\.\d+)?px$/.test(t2), parse: (t2, e2) => Number(t2.slice(0, -2)) / e2 * 100 }, { test: (t2) => /^-?\d+(\.\d+)?$/.test(t2), parse: (t2, e2) => Number(t2) / e2 * 100 }];
      Ki = (t2, e2) => {
        if (!Number.isFinite(e2) || 0 === e2) return null;
        if ("number" == typeof t2) return Number.isFinite(t2) ? t2 / e2 * 100 : null;
        const i2 = t2.trim(), s2 = Wi.find(((t3) => t3.test(i2)));
        return s2 ? s2.parse(i2, e2) : null;
      };
      Xi = [_t, n`
    :host {
      display: block;
      --vsc-row-even-background: transparent;
      --vsc-row-odd-background: transparent;
      --vsc-row-border-bottom-width: 0;
      --vsc-row-border-top-width: 0;
      --vsc-row-display: table-row;
    }

    :host([bordered]),
    :host([bordered-rows]) {
      --vsc-row-border-bottom-width: 1px;
    }

    :host([compact]) {
      --vsc-row-display: block;
    }

    :host([bordered][compact]),
    :host([bordered-rows][compact]) {
      --vsc-row-border-bottom-width: 0;
      --vsc-row-border-top-width: 1px;
    }

    :host([zebra]) {
      --vsc-row-even-background: var(
        --vscode-keybindingTable-rowsBackground,
        rgba(204, 204, 204, 0.04)
      );
    }

    :host([zebra-odd]) {
      --vsc-row-odd-background: var(
        --vscode-keybindingTable-rowsBackground,
        rgba(204, 204, 204, 0.04)
      );
    }

    ::slotted(vscode-table-row) {
      width: 100%;
    }

    .wrapper {
      height: 100%;
      max-width: 100%;
      overflow: hidden;
      position: relative;
      width: 100%;
    }

    .wrapper.select-disabled {
      user-select: none;
    }

    .wrapper.resize-cursor {
      cursor: ew-resize;
    }

    .wrapper.compact-view .header-slot-wrapper {
      height: 0;
      overflow: hidden;
    }

    .scrollable {
      height: 100%;
    }

    .scrollable:before {
      background-color: transparent;
      content: '';
      display: block;
      height: 1px;
      position: absolute;
      width: 100%;
    }

    .wrapper:not(.compact-view) .scrollable:not([scrolled]):before {
      background-color: var(
        --vscode-editorGroup-border,
        rgba(255, 255, 255, 0.09)
      );
    }

    .sash {
      visibility: hidden;
    }

    :host([bordered-columns]) .sash,
    :host([bordered]) .sash {
      visibility: visible;
    }

    :host([resizable]) .wrapper:hover .sash {
      visibility: visible;
    }

    .sash {
      height: 100%;
      position: absolute;
      top: 0;
      width: 1px;
    }

    .wrapper.compact-view .sash {
      display: none;
    }

    .sash.resizable {
      cursor: ew-resize;
    }

    .sash-visible {
      background-color: var(
        --vscode-editorGroup-border,
        rgba(255, 255, 255, 0.09)
      );
      height: calc(100% - 30px);
      position: absolute;
      top: 30px;
      width: ${1}px;
    }

    .sash.hover .sash-visible {
      background-color: var(--vscode-sash-hoverBorder, #0078d4);
      transition: background-color 50ms linear 300ms;
    }

    .sash .sash-clickable {
      height: 100%;
      left: ${-2}px;
      position: absolute;
      width: ${5}px;
    }
  `];
      Ji = class {
        constructor(t2) {
          this._hostWidth = 0, this._hostX = 0, this._activeSplitter = null, this._columnMinWidths = /* @__PURE__ */ new Map(), this._columnWidths = [], this._dragState = null, this._cachedSplitterPositions = null, (this._host = t2).addController(this);
        }
        hostConnected() {
          this.saveHostDimensions();
        }
        get isDragging() {
          return null !== this._dragState;
        }
        get splitterPositions() {
          if (this._cachedSplitterPositions) return this._cachedSplitterPositions;
          const t2 = [];
          let e2 = 0;
          for (let i2 = 0; i2 < this._columnWidths.length - 1; i2++) e2 += this._columnWidths[i2], t2.push(e2);
          return this._cachedSplitterPositions = t2, t2;
        }
        getActiveSplitterCalculatedPosition() {
          const t2 = this.splitterPositions;
          if (!this._dragState) return 0;
          const e2 = t2[this._dragState.splitterIndex];
          return this._toPx(e2);
        }
        get columnWidths() {
          return this._columnWidths;
        }
        get columnMinWidths() {
          return new Map(this._columnMinWidths);
        }
        saveHostDimensions() {
          const t2 = this._host.getBoundingClientRect(), { width: e2, x: i2 } = t2;
          return this._hostWidth = e2, this._hostX = i2, this;
        }
        setActiveSplitter(t2) {
          return this._activeSplitter = t2, this;
        }
        getActiveSplitter() {
          return this._activeSplitter;
        }
        setColumnMinWidthAt(t2, e2) {
          return this._columnMinWidths.set(t2, e2), this._host.requestUpdate(), this;
        }
        setColumWidths(t2) {
          return this._columnWidths = t2, this._cachedSplitterPositions = null, this._host.requestUpdate(), this;
        }
        shouldDrag(t2) {
          return +t2.currentTarget.dataset.index === this._dragState?.splitterIndex;
        }
        startDrag(t2) {
          if (t2.stopPropagation(), this._dragState) return;
          this._activeSplitter?.setPointerCapture(t2.pointerId);
          const e2 = t2.pageX, i2 = t2.currentTarget, s2 = e2 - i2.getBoundingClientRect().x;
          this._dragState = { dragOffset: s2, pointerId: t2.pointerId, splitterIndex: +i2.dataset.index, prevX: e2 - s2 }, this._host.requestUpdate();
        }
        drag(t2) {
          if (t2.stopPropagation(), !t2?.currentTarget?.hasPointerCapture?.(t2.pointerId)) return;
          if (!this._dragState) return;
          if (t2.pointerId !== this._dragState.pointerId) return;
          if (!this.shouldDrag(t2)) return;
          const e2 = t2.pageX, i2 = e2 - this._dragState.dragOffset, s2 = i2 - this._dragState.prevX, o2 = this._toPercent(s2);
          this._dragState.prevX = i2;
          const r2 = this.getActiveSplitterCalculatedPosition();
          s2 <= 0 && e2 > r2 + this._hostX || s2 > 0 && e2 < r2 + this._hostX || (this._columnWidths = (function(t3, e3, i3, s3) {
            const o3 = [...t3];
            if (0 === i3 || e3 < 0 || e3 >= t3.length - 1) return o3;
            const r3 = Math.abs(i3);
            let n2 = r3;
            const h2 = [], a2 = [];
            for (let t4 = e3; t4 >= 0; t4--) h2.push(t4);
            for (let i4 = e3 + 1; i4 < t3.length; i4++) a2.push(i4);
            const l2 = i3 > 0 ? a2 : h2, c2 = i3 > 0 ? h2 : a2;
            let d2 = 0;
            for (const t4 of l2) d2 += Math.max(0, o3[t4] - (s3.get(t4) ?? 0));
            if (d2 < n2) return o3;
            for (const t4 of l2) {
              if (0 === n2) break;
              const e4 = Math.max(0, o3[t4] - (s3.get(t4) ?? 0)), i4 = Math.min(e4, n2);
              o3[t4] = o3[t4] - i4, n2 -= i4;
            }
            let u2 = r3;
            for (const t4 of c2) {
              if (0 === u2) break;
              o3[t4] = o3[t4] + u2, u2 = 0;
            }
            return o3;
          })(this._columnWidths, this._dragState.splitterIndex, o2, this._columnMinWidths), this._cachedSplitterPositions = null, this._host.requestUpdate());
        }
        stopDrag(t2) {
          if (t2.stopPropagation(), !this._dragState) return;
          const e2 = t2.currentTarget;
          try {
            e2.releasePointerCapture(this._dragState.pointerId);
          } catch (t3) {
          }
          this._dragState = null, this._activeSplitter = null, this._host.requestUpdate();
        }
        _toPercent(t2) {
          return ((t3, e2) => t3 / e2 * 100)(t2, this._hostWidth);
        }
        _toPx(t2) {
          return ((t3, e2) => t3 / 100 * e2)(t2, this._hostWidth);
        }
      };
      Yi = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      Zi = class extends kt {
        set columns(t2) {
          if (!Array.isArray(t2)) return this.warn('Invalid value for "columns": expected an array.'), void (this._columns = []);
          this._columns = t2, this.isConnected && this._initDefaultColumnSizes();
        }
        get columns() {
          return this._columns;
        }
        constructor() {
          super(), this.role = "table", this.resizable = false, this.responsive = false, this.bordered = false, this.borderedColumns = false, this.borderedRows = false, this.breakpoint = 300, this.minColumnWidth = "50px", this.delayedResizing = false, this.compact = false, this.zebra = false, this.zebraOdd = false, this._sashPositions = [], this._isDragging = false, this._sashHovers = [], this._columns = [], this._activeSashElementIndex = -1, this._componentH = 0, this._componentW = 0, this._headerCells = [], this._cellsOfFirstRow = [], this._prevHeaderHeight = 0, this._prevComponentHeight = 0, this._columnResizeController = new Ji(this), this._componentResizeObserverCallback = () => {
            this._memoizeComponentDimensions(), this._updateResizeHandlersSize(), this.responsive && this._toggleCompactView(), this._resizeTableBody();
          }, this._headerResizeObserverCallback = () => {
            this._updateResizeHandlersSize();
          }, this._bodyResizeObserverCallback = () => {
            this._resizeTableBody();
          }, this._handleSplitterPointerMove = (t2) => {
            this._columnResizeController.shouldDrag(t2) && (this._columnResizeController.drag(t2), this.delayedResizing ? this._resizeColumns(false) : this._resizeColumns(true));
          }, this._handleSplitterPointerUp = (t2) => {
            this._stopDrag(t2);
          }, this._handleSplitterPointerCancel = (t2) => {
            this._stopDrag(t2);
          }, this._handleMinColumnWidthChange = (t2) => {
            const { columnIndex: e2, propertyValue: i2 } = t2.detail, s2 = Ki(i2, this._componentW);
            s2 && this._columnResizeController.setColumnMinWidthAt(e2, s2);
          }, this.addEventListener("vsc-table-change-min-column-width", this._handleMinColumnWidthChange);
        }
        connectedCallback() {
          super.connectedCallback(), this._memoizeComponentDimensions(), this._initDefaultColumnSizes();
        }
        disconnectedCallback() {
          super.disconnectedCallback(), this._componentResizeObserver?.unobserve(this), this._componentResizeObserver?.disconnect(), this._bodyResizeObserver?.disconnect();
        }
        willUpdate(t2) {
          if (t2.has("minColumnWidth")) {
            const t3 = Ki(this.minColumnWidth, this._componentW) ?? 0, e2 = this._columnResizeController.columnMinWidths, i2 = this._columnResizeController.columnWidths;
            for (let s2 = 0; s2 < i2.length; s2++) e2.has(s2) || this._columnResizeController.setColumnMinWidthAt(s2, t3);
          }
        }
        _memoizeComponentDimensions() {
          const t2 = this.getBoundingClientRect();
          this._componentH = t2.height, this._componentW = t2.width;
        }
        _queryHeaderCells() {
          const t2 = this._assignedHeaderElements;
          return t2 && t2[0] ? Array.from(t2[0].querySelectorAll("vscode-table-header-cell")) : [];
        }
        _getHeaderCells() {
          return this._headerCells.length || (this._headerCells = this._queryHeaderCells()), this._headerCells;
        }
        _queryCellsOfFirstRow() {
          const t2 = this._assignedBodyElements;
          return t2 && t2[0] ? Array.from(t2[0].querySelectorAll("vscode-table-row:first-child vscode-table-cell")) : [];
        }
        _getCellsOfFirstRow() {
          return this._cellsOfFirstRow.length || (this._cellsOfFirstRow = this._queryCellsOfFirstRow()), this._cellsOfFirstRow;
        }
        _resizeTableBody() {
          let t2 = 0, e2 = 0;
          const i2 = this.getBoundingClientRect().height;
          this._assignedHeaderElements && this._assignedHeaderElements.length && (t2 = this._assignedHeaderElements[0].getBoundingClientRect().height), this._assignedBodyElements && this._assignedBodyElements.length && (e2 = this._assignedBodyElements[0].getBoundingClientRect().height);
          const s2 = e2 - t2 - i2;
          this._scrollableElement.style.height = s2 > 0 ? i2 - t2 + "px" : "auto";
        }
        _initResizeObserver() {
          this._componentResizeObserver = new ResizeObserver(this._componentResizeObserverCallback), this._componentResizeObserver.observe(this), this._headerResizeObserver = new ResizeObserver(this._headerResizeObserverCallback), this._headerResizeObserver.observe(this._headerElement);
        }
        _calculateInitialColumnWidths() {
          const t2 = this._getHeaderCells().length;
          let e2 = this.columns.slice(0, t2);
          const i2 = e2.filter(((t3) => "auto" === t3)).length + t2 - e2.length;
          let s2 = 100;
          if (e2 = e2.map(((t3) => {
            const e3 = Ki(t3, this._componentW);
            return null === e3 ? "auto" : (s2 -= e3, e3);
          })), e2.length < t2) for (let i3 = e2.length; i3 < t2; i3++) e2.push("auto");
          return e2 = e2.map(((t3) => "auto" === t3 ? s2 / i2 : t3)), e2;
        }
        _initHeaderCellSizes(t2) {
          this._getHeaderCells().forEach(((e2, i2) => {
            e2.style.width = `${t2[i2]}%`;
          }));
        }
        _initBodyColumnSizes(t2) {
          this._getCellsOfFirstRow().forEach(((e2, i2) => {
            e2.style.width = `${t2[i2]}%`;
          }));
        }
        _initSashes(t2) {
          const e2 = t2.length;
          let i2 = 0;
          this._sashPositions = [], t2.forEach(((t3, s2) => {
            if (s2 < e2 - 1) {
              const e3 = i2 + t3;
              this._sashPositions.push(e3), i2 = e3;
            }
          }));
        }
        _initDefaultColumnSizes() {
          const t2 = this._calculateInitialColumnWidths();
          this._columnResizeController.setColumWidths(t2.map(((t3) => t3))), this._initHeaderCellSizes(t2), this._initBodyColumnSizes(t2), this._initSashes(t2);
        }
        _updateResizeHandlersSize() {
          const t2 = this._headerElement.getBoundingClientRect();
          if (t2.height === this._prevHeaderHeight && this._componentH === this._prevComponentHeight) return;
          this._prevHeaderHeight = t2.height, this._prevComponentHeight = this._componentH;
          const e2 = this._componentH - t2.height;
          this._sashVisibleElements.forEach(((i2) => {
            i2.style.height = `${e2}px`, i2.style.top = `${t2.height}px`;
          }));
        }
        _applyCompactViewColumnLabels() {
          const t2 = this._getHeaderCells().map(((t3) => t3.innerText));
          this.querySelectorAll("vscode-table-row").forEach(((e2) => {
            e2.querySelectorAll("vscode-table-cell").forEach(((e3, i2) => {
              e3.columnLabel = t2[i2], e3.compact = true;
            }));
          }));
        }
        _clearCompactViewColumnLabels() {
          this.querySelectorAll("vscode-table-cell").forEach(((t2) => {
            t2.columnLabel = "", t2.compact = false;
          }));
        }
        _toggleCompactView() {
          const t2 = this.getBoundingClientRect().width < this.breakpoint;
          this.compact !== t2 && (this.compact = t2, t2 ? this._applyCompactViewColumnLabels() : this._clearCompactViewColumnLabels());
        }
        _stopDrag(t2) {
          const e2 = this._columnResizeController.getActiveSplitter();
          e2 && (e2.removeEventListener("pointermove", this._handleSplitterPointerMove), e2.removeEventListener("pointerup", this._handleSplitterPointerUp), e2.removeEventListener("pointercancel", this._handleSplitterPointerCancel)), this._columnResizeController.stopDrag(t2), this._resizeColumns(true), this._sashHovers[this._activeSashElementIndex] = false, this._isDragging = false, this._activeSashElementIndex = -1;
        }
        _onDefaultSlotChange() {
          this._assignedElements.forEach(((t2) => {
            "vscode-table-header" !== t2.tagName.toLowerCase() ? "vscode-table-body" !== t2.tagName.toLowerCase() || (t2.slot = "body") : t2.slot = "header";
          }));
        }
        _onHeaderSlotChange() {
          this._headerCells = this._queryHeaderCells();
          [].fill(0, 0, this._headerCells.length - 1), this._headerCells.forEach(((t2, e2) => {
            if (t2.index = e2, t2.minWidth) {
              const i2 = Ki(t2.minWidth, this._componentW) ?? 0;
              this._columnResizeController.setColumnMinWidthAt(e2, i2);
            }
          }));
        }
        _onBodySlotChange() {
          if (this._initDefaultColumnSizes(), this._initResizeObserver(), this._updateResizeHandlersSize(), !this._bodyResizeObserver) {
            const t2 = this._assignedBodyElements[0] ?? null;
            t2 && (this._bodyResizeObserver = new ResizeObserver(this._bodyResizeObserverCallback), this._bodyResizeObserver.observe(t2));
          }
        }
        _onSashMouseOver(t2) {
          if (this._isDragging) return;
          const e2 = t2.currentTarget, i2 = Number(e2.dataset.index);
          this._sashHovers[i2] = true, this.requestUpdate();
        }
        _onSashMouseOut(t2) {
          if (t2.stopPropagation(), this._isDragging) return;
          const e2 = t2.currentTarget, i2 = Number(e2.dataset.index);
          this._sashHovers[i2] = false, this.requestUpdate();
        }
        _resizeColumns(t2 = true) {
          const e2 = this._columnResizeController.columnWidths;
          if (this._getHeaderCells().forEach(((t3, i2) => t3.style.width = `${e2[i2]}%`)), t2) {
            this._getCellsOfFirstRow().forEach(((t3, i2) => t3.style.width = `${e2[i2]}%`));
          }
        }
        _handleSplitterPointerDown(t2) {
          t2.stopPropagation();
          const e2 = t2.currentTarget;
          this._columnResizeController.saveHostDimensions().setActiveSplitter(e2).startDrag(t2), e2.addEventListener("pointermove", this._handleSplitterPointerMove), e2.addEventListener("pointerup", this._handleSplitterPointerUp), e2.addEventListener("pointercancel", this._handleSplitterPointerCancel);
        }
        render() {
          const t2 = this._columnResizeController.splitterPositions.map(((t3, e3) => {
            const i2 = Mt({ sash: true, hover: this._sashHovers[e3], resizable: this.resizable }), s2 = `${t3}%`;
            return this.resizable ? U`
            <div
              class=${i2}
              data-index=${e3}
              .style=${Ft({ left: s2 })}
              @pointerdown=${this._handleSplitterPointerDown}
              @mouseover=${this._onSashMouseOver}
              @mouseout=${this._onSashMouseOut}
            >
              <div class="sash-visible"></div>
              <div class="sash-clickable"></div>
            </div>
          ` : U`<div
            class=${i2}
            data-index=${e3}
            .style=${Ft({ left: s2 })}
          >
            <div class="sash-visible"></div>
          </div>`;
          })), e2 = Mt({ wrapper: true, "select-disabled": this._columnResizeController.isDragging, "resize-cursor": this._columnResizeController.isDragging, "compact-view": this.compact });
          return U`
      <div class=${e2}>
        <div class="header">
          <slot name="caption"></slot>
          <div class="header-slot-wrapper">
            <slot name="header" @slotchange=${this._onHeaderSlotChange}></slot>
          </div>
        </div>
        <vscode-scrollable class="scrollable">
          <div>
            <slot name="body" @slotchange=${this._onBodySlotChange}></slot>
          </div>
        </vscode-scrollable>
        ${t2}
        <slot @slotchange=${this._onDefaultSlotChange}></slot>
      </div>
    `;
        }
      };
      Zi.styles = Xi, Yi([pt({ reflect: true })], Zi.prototype, "role", void 0), Yi([pt({ type: Boolean, reflect: true })], Zi.prototype, "resizable", void 0), Yi([pt({ type: Boolean, reflect: true })], Zi.prototype, "responsive", void 0), Yi([pt({ type: Boolean, reflect: true })], Zi.prototype, "bordered", void 0), Yi([pt({ type: Boolean, reflect: true, attribute: "bordered-columns" })], Zi.prototype, "borderedColumns", void 0), Yi([pt({ type: Boolean, reflect: true, attribute: "bordered-rows" })], Zi.prototype, "borderedRows", void 0), Yi([pt({ type: Number })], Zi.prototype, "breakpoint", void 0), Yi([pt({ type: Array })], Zi.prototype, "columns", null), Yi([pt({ attribute: "min-column-width" })], Zi.prototype, "minColumnWidth", void 0), Yi([pt({ type: Boolean, reflect: true, attribute: "delayed-resizing" })], Zi.prototype, "delayedResizing", void 0), Yi([pt({ type: Boolean, reflect: true })], Zi.prototype, "compact", void 0), Yi([pt({ type: Boolean, reflect: true })], Zi.prototype, "zebra", void 0), Yi([pt({ type: Boolean, reflect: true, attribute: "zebra-odd" })], Zi.prototype, "zebraOdd", void 0), Yi([ft(".header")], Zi.prototype, "_headerElement", void 0), Yi([ft(".scrollable")], Zi.prototype, "_scrollableElement", void 0), Yi([/* @__PURE__ */ (function(t2) {
        return (e2, i2) => bt(0, 0, { get() {
          return (this.renderRoot ?? (gt ??= document.createDocumentFragment())).querySelectorAll(t2);
        } });
      })(".sash-visible")], Zi.prototype, "_sashVisibleElements", void 0), Yi([mt({ flatten: true, selector: "vscode-table-header, vscode-table-body" })], Zi.prototype, "_assignedElements", void 0), Yi([mt({ slot: "header", flatten: true, selector: "vscode-table-header" })], Zi.prototype, "_assignedHeaderElements", void 0), Yi([mt({ slot: "body", flatten: true, selector: "vscode-table-body" })], Zi.prototype, "_assignedBodyElements", void 0), Yi([vt()], Zi.prototype, "_sashPositions", void 0), Yi([vt()], Zi.prototype, "_isDragging", void 0), Zi = Yi([$t("vscode-table")], Zi);
      Qi = [_t, n`
    :host {
      display: block;
    }

    .header {
      align-items: center;
      display: flex;
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      font-weight: var(--vscode-font-weight, normal);
      width: 100%;
    }

    .header {
      border-bottom-color: var(--vscode-settings-headerBorder, #2b2b2b);
      border-bottom-style: solid;
      border-bottom-width: 1px;
    }

    .header.panel {
      background-color: var(--vscode-panel-background, #181818);
      border-bottom-width: 0;
      box-sizing: border-box;
      padding-left: 8px;
      padding-right: 8px;
    }

    .tablist {
      display: flex;
      margin-bottom: -1px;
    }

    slot[name='addons'] {
      display: block;
      margin-left: auto;
    }
  `];
      ts = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      es = class extends kt {
        constructor() {
          super(), this.panel = false, this.selectedIndex = 0, this._tabHeaders = [], this._tabPanels = [], this._componentId = "", this._tabFocus = 0, this._componentId = Ae();
        }
        attributeChangedCallback(t2, e2, i2) {
          super.attributeChangedCallback(t2, e2, i2), "selected-index" === t2 && this._setActiveTab(), "panel" === t2 && (this._tabHeaders.forEach(((t3) => t3.panel = null !== i2)), this._tabPanels.forEach(((t3) => t3.panel = null !== i2)));
        }
        _dispatchSelectEvent() {
          this.dispatchEvent(new CustomEvent("vsc-tabs-select", { detail: { selectedIndex: this.selectedIndex }, composed: true }));
        }
        _setActiveTab() {
          this._tabFocus = this.selectedIndex, this._tabPanels.forEach(((t2, e2) => {
            t2.hidden = e2 !== this.selectedIndex;
          })), this._tabHeaders.forEach(((t2, e2) => {
            t2.active = e2 === this.selectedIndex;
          }));
        }
        _focusPrevTab() {
          0 === this._tabFocus ? this._tabFocus = this._tabHeaders.length - 1 : this._tabFocus -= 1;
        }
        _focusNextTab() {
          this._tabFocus === this._tabHeaders.length - 1 ? this._tabFocus = 0 : this._tabFocus += 1;
        }
        _onHeaderKeyDown(t2) {
          "ArrowLeft" !== t2.key && "ArrowRight" !== t2.key || (t2.preventDefault(), this._tabHeaders[this._tabFocus].setAttribute("tabindex", "-1"), "ArrowLeft" === t2.key ? this._focusPrevTab() : "ArrowRight" === t2.key && this._focusNextTab(), this._tabHeaders[this._tabFocus].setAttribute("tabindex", "0"), this._tabHeaders[this._tabFocus].focus()), "Enter" === t2.key && (t2.preventDefault(), this.selectedIndex = this._tabFocus, this._dispatchSelectEvent());
        }
        _moveHeadersToHeaderSlot() {
          const t2 = this._mainSlotElements.filter(((t3) => t3 instanceof Ai));
          t2.length > 0 && t2.forEach(((t3) => t3.setAttribute("slot", "header")));
        }
        _onMainSlotChange() {
          this._moveHeadersToHeaderSlot(), this._tabPanels = this._mainSlotElements.filter(((t2) => t2 instanceof Ei)), this._tabPanels.forEach(((t2, e2) => {
            t2.ariaLabelledby = `t${this._componentId}-h${e2}`, t2.id = `t${this._componentId}-p${e2}`, t2.panel = this.panel;
          })), this._setActiveTab();
        }
        _onHeaderSlotChange() {
          this._tabHeaders = this._headerSlotElements.filter(((t2) => t2 instanceof Ai)), this._tabHeaders.forEach(((t2, e2) => {
            t2.tabId = e2, t2.id = `t${this._componentId}-h${e2}`, t2.ariaControls = `t${this._componentId}-p${e2}`, t2.panel = this.panel, t2.active = e2 === this.selectedIndex;
          }));
        }
        _onHeaderClick(t2) {
          const e2 = t2.composedPath().find(((t3) => t3 instanceof Ai));
          e2 && (this.selectedIndex = e2.tabId, this._setActiveTab(), this._dispatchSelectEvent());
        }
        render() {
          return U`
      <div
        class=${Mt({ header: true, panel: this.panel })}
        @click=${this._onHeaderClick}
        @keydown=${this._onHeaderKeyDown}
      >
        <div role="tablist" class="tablist">
          <slot
            name="header"
            @slotchange=${this._onHeaderSlotChange}
            role="tablist"
          ></slot>
        </div>
        <slot name="addons"></slot>
      </div>
      <slot @slotchange=${this._onMainSlotChange}></slot>
    `;
        }
      };
      es.styles = Qi, ts([pt({ type: Boolean, reflect: true })], es.prototype, "panel", void 0), ts([pt({ type: Number, reflect: true, attribute: "selected-index" })], es.prototype, "selectedIndex", void 0), ts([mt({ slot: "header" })], es.prototype, "_headerSlotElements", void 0), ts([mt()], es.prototype, "_mainSlotElements", void 0), es = ts([$t("vscode-tabs")], es);
      is = [_t, n`
    :host {
      display: inline-block;
      height: auto;
      position: relative;
      width: 320px;
    }

    :host([cols]) {
      width: auto;
    }

    :host([rows]) {
      height: auto;
    }

    .shadow {
      box-shadow: var(--vscode-scrollbar-shadow, #000000) 0 6px 6px -6px inset;
      display: none;
      inset: 0 0 auto 0;
      height: 6px;
      pointer-events: none;
      position: absolute;
      width: 100%;
    }

    .shadow.visible {
      display: block;
    }

    textarea {
      background-color: var(--vscode-settings-textInputBackground, #313131);
      border-color: var(--vscode-settings-textInputBorder, transparent);
      border-radius: 4px;
      border-style: solid;
      border-width: 1px;
      box-sizing: border-box;
      color: var(--vscode-settings-textInputForeground, #cccccc);
      display: block;
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      font-weight: var(--vscode-font-weight, normal);
      height: 100%;
      width: 100%;
    }

    :host([cols]) textarea {
      width: auto;
    }

    :host([rows]) textarea {
      height: auto;
    }

    :host([invalid]) textarea,
    :host(:invalid) textarea {
      background-color: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      border-color: var(--vscode-inputValidation-errorBorder, #be1100);
    }

    textarea.monospace {
      background-color: var(--vscode-editor-background, #1f1f1f);
      color: var(--vscode-editor-foreground, #cccccc);
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--vscode-editor-font-size, 14px);
      font-weight: var(--vscode-editor-font-weight, normal);
    }

    .textarea.monospace::placeholder {
      color: var(
        --vscode-editor-inlineValuesForeground,
        rgba(255, 255, 255, 0.5)
      );
    }

    textarea.cursor-pointer {
      cursor: pointer;
    }

    textarea:focus {
      border-color: var(--vscode-focusBorder, #0078d4);
      outline: none;
    }

    textarea::placeholder {
      color: var(--vscode-input-placeholderForeground, #989898);
      opacity: 1;
    }

    textarea::-webkit-scrollbar-track {
      background-color: transparent;
    }

    textarea::-webkit-scrollbar {
      width: 14px;
    }

    textarea::-webkit-scrollbar-thumb {
      background-color: transparent;
    }

    textarea:hover::-webkit-scrollbar-thumb {
      background-color: var(
        --vscode-scrollbarSlider-background,
        rgba(121, 121, 121, 0.4)
      );
    }

    textarea::-webkit-scrollbar-thumb:hover {
      background-color: var(
        --vscode-scrollbarSlider-hoverBackground,
        rgba(100, 100, 100, 0.7)
      );
    }

    textarea::-webkit-scrollbar-thumb:active {
      background-color: var(
        --vscode-scrollbarSlider-activeBackground,
        rgba(191, 191, 191, 0.4)
      );
    }

    textarea::-webkit-scrollbar-corner {
      background-color: transparent;
    }

    textarea::-webkit-resizer {
      background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAHCAYAAADEUlfTAAAAAXNSR0IB2cksfwAAAAlwSFlzAAALEwAACxMBAJqcGAAAACJJREFUeJxjYMAOZuIQZ5j5//9/rJJESczEKYGsG6cEXgAAsEEefMxkua4AAAAASUVORK5CYII=');
      background-repeat: no-repeat;
      background-position: right bottom;
    }
  `];
      ss = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      os = class extends kt {
        set value(t2) {
          this._value = t2, this._internals.setFormValue(t2);
        }
        get value() {
          return this._value;
        }
        get wrappedElement() {
          return this._textareaEl;
        }
        get form() {
          return this._internals.form;
        }
        get type() {
          return "textarea";
        }
        get validity() {
          return this._internals.validity;
        }
        get validationMessage() {
          return this._internals.validationMessage;
        }
        get willValidate() {
          return this._internals.willValidate;
        }
        set minlength(t2) {
          this.minLength = t2;
        }
        get minlength() {
          return this.minLength;
        }
        set maxlength(t2) {
          this.maxLength = t2;
        }
        get maxlength() {
          return this.maxLength;
        }
        constructor() {
          super(), this.autocomplete = void 0, this.autofocus = false, this.defaultValue = "", this.disabled = false, this.invalid = false, this.label = "", this.maxLength = void 0, this.minLength = void 0, this.rows = void 0, this.cols = void 0, this.name = void 0, this.placeholder = void 0, this.readonly = false, this.resize = "none", this.required = false, this.spellcheck = false, this.monospace = false, this._value = "", this._textareaPointerCursor = false, this._shadow = false, this._internals = this.attachInternals();
        }
        connectedCallback() {
          super.connectedCallback(), this.updateComplete.then((() => {
            this._textareaEl.checkValidity(), this._setValidityFromInput(), this._internals.setFormValue(this._textareaEl.value);
          }));
        }
        updated(t2) {
          const e2 = ["maxLength", "minLength", "required"];
          for (const i2 of t2.keys()) if (e2.includes(String(i2))) {
            this.updateComplete.then((() => {
              this._setValidityFromInput();
            }));
            break;
          }
        }
        formResetCallback() {
          this.value = this.defaultValue;
        }
        formStateRestoreCallback(t2, e2) {
          this.updateComplete.then((() => {
            this._value = t2;
          }));
        }
        checkValidity() {
          return this._internals.checkValidity();
        }
        reportValidity() {
          return this._internals.reportValidity();
        }
        _setValidityFromInput() {
          this._internals.setValidity(this._textareaEl.validity, this._textareaEl.validationMessage, this._textareaEl);
        }
        _dataChanged() {
          this._value = this._textareaEl.value, this._internals.setFormValue(this._textareaEl.value);
        }
        _handleChange() {
          this._dataChanged(), this._setValidityFromInput(), this.dispatchEvent(new Event("change"));
        }
        _handleInput() {
          this._dataChanged(), this._setValidityFromInput();
        }
        _handleMouseMove(t2) {
          if (this._textareaEl.clientHeight >= this._textareaEl.scrollHeight) return void (this._textareaPointerCursor = false);
          const e2 = this._textareaEl.getBoundingClientRect(), i2 = t2.clientX;
          this._textareaPointerCursor = i2 >= e2.left + e2.width - 14 - 2;
        }
        _handleScroll() {
          this._shadow = this._textareaEl.scrollTop > 0;
        }
        render() {
          return U`
      <div
        class=${Mt({ shadow: true, visible: this._shadow })}
      ></div>
      <textarea
        autocomplete=${Dt(this.autocomplete)}
        ?autofocus=${this.autofocus}
        ?disabled=${this.disabled}
        aria-label=${this.label}
        id="textarea"
        class=${Mt({ monospace: this.monospace, "cursor-pointer": this._textareaPointerCursor })}
        maxlength=${Dt(this.maxLength)}
        minlength=${Dt(this.minLength)}
        rows=${Dt(this.rows)}
        cols=${Dt(this.cols)}
        name=${Dt(this.name)}
        placeholder=${Dt(this.placeholder)}
        ?readonly=${this.readonly}
        .style=${Ft({ resize: this.resize })}
        ?required=${this.required}
        spellcheck=${this.spellcheck}
        @change=${this._handleChange}
        @input=${this._handleInput}
        @mousemove=${this._handleMouseMove}
        @scroll=${this._handleScroll}
        .value=${this._value}
      ></textarea>
    `;
        }
      };
      os.styles = is, os.formAssociated = true, os.shadowRootOptions = { ...lt.shadowRootOptions, delegatesFocus: true }, ss([pt()], os.prototype, "autocomplete", void 0), ss([pt({ type: Boolean, reflect: true })], os.prototype, "autofocus", void 0), ss([pt({ attribute: "default-value" })], os.prototype, "defaultValue", void 0), ss([pt({ type: Boolean, reflect: true })], os.prototype, "disabled", void 0), ss([pt({ type: Boolean, reflect: true })], os.prototype, "invalid", void 0), ss([pt({ attribute: false })], os.prototype, "label", void 0), ss([pt({ type: Number })], os.prototype, "maxLength", void 0), ss([pt({ type: Number })], os.prototype, "minLength", void 0), ss([pt({ type: Number })], os.prototype, "rows", void 0), ss([pt({ type: Number })], os.prototype, "cols", void 0), ss([pt()], os.prototype, "name", void 0), ss([pt()], os.prototype, "placeholder", void 0), ss([pt({ type: Boolean, reflect: true })], os.prototype, "readonly", void 0), ss([pt()], os.prototype, "resize", void 0), ss([pt({ type: Boolean, reflect: true })], os.prototype, "required", void 0), ss([pt({ type: Boolean })], os.prototype, "spellcheck", void 0), ss([pt({ type: Boolean, reflect: true })], os.prototype, "monospace", void 0), ss([pt()], os.prototype, "value", null), ss([ft("#textarea")], os.prototype, "_textareaEl", void 0), ss([vt()], os.prototype, "_value", void 0), ss([vt()], os.prototype, "_textareaPointerCursor", void 0), ss([vt()], os.prototype, "_shadow", void 0), os = ss([$t("vscode-textarea")], os);
      rs = r(St());
      ns = [_t, n`
    :host {
      display: inline-block;
      width: 320px;
    }

    .root {
      align-items: center;
      background-color: var(--vscode-settings-textInputBackground, #313131);
      border-color: var(
        --vscode-settings-textInputBorder,
        var(--vscode-settings-textInputBackground, #3c3c3c)
      );
      border-radius: 4px;
      border-style: solid;
      border-width: 1px;
      box-sizing: border-box;
      color: var(--vscode-settings-textInputForeground, #cccccc);
      display: flex;
      max-width: 100%;
      position: relative;
      width: 100%;
    }

    :host([focused]) .root {
      border-color: var(--vscode-focusBorder, #0078d4);
    }

    :host([invalid]),
    :host(:invalid) {
      border-color: var(--vscode-inputValidation-errorBorder, #be1100);
    }

    :host([invalid]) input,
    :host(:invalid) input {
      background-color: var(--vscode-inputValidation-errorBackground, #5a1d1d);
    }

    ::slotted([slot='content-before']) {
      display: block;
      margin-left: 2px;
    }

    ::slotted([slot='content-after']) {
      display: block;
      margin-right: 2px;
    }

    slot[name='content-before'],
    slot[name='content-after'] {
      align-items: center;
      display: flex;
    }

    input {
      background-color: var(--vscode-settings-textInputBackground, #313131);
      border: 0;
      box-sizing: border-box;
      color: var(--vscode-settings-textInputForeground, #cccccc);
      display: block;
      font-family: var(--vscode-font-family, ${rs});
      font-size: var(--vscode-font-size, 13px);
      font-weight: var(--vscode-font-weight, 'normal');
      line-height: 18px;
      outline: none;
      padding-bottom: 3px;
      padding-left: 4px;
      padding-right: 4px;
      padding-top: 3px;
      width: 100%;
    }

    input:read-only:not([type='file']) {
      cursor: not-allowed;
    }

    input::placeholder {
      color: var(--vscode-input-placeholderForeground, #989898);
      opacity: 1;
    }

    input[type='file'] {
      line-height: 24px;
      padding-bottom: 0;
      padding-left: 2px;
      padding-top: 0;
    }

    input[type='file']::file-selector-button {
      background-color: var(--vscode-button-background, #0078d4);
      border: 0;
      border-radius: 2px;
      color: var(--vscode-button-foreground, #ffffff);
      cursor: pointer;
      font-family: var(--vscode-font-family, ${rs});
      font-size: var(--vscode-font-size, 13px);
      font-weight: var(--vscode-font-weight, 'normal');
      line-height: 20px;
      padding: 0 14px;
    }

    input[type='file']::file-selector-button:hover {
      background-color: var(--vscode-button-hoverBackground, #026ec1);
    }
  `];
      hs = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      as = class extends kt {
        set type(t2) {
          this._type = ["color", "date", "datetime-local", "email", "file", "month", "number", "password", "search", "tel", "text", "time", "url", "week"].includes(t2) ? t2 : "text";
        }
        get type() {
          return this._type;
        }
        set value(t2) {
          "file" !== this.type && (this._value = t2, this._internals.setFormValue(t2)), this.updateComplete.then((() => {
            this._setValidityFromInput();
          }));
        }
        get value() {
          return this._value;
        }
        set minlength(t2) {
          this.minLength = t2;
        }
        get minlength() {
          return this.minLength;
        }
        set maxlength(t2) {
          this.maxLength = t2;
        }
        get maxlength() {
          return this.maxLength;
        }
        get form() {
          return this._internals.form;
        }
        get validity() {
          return this._internals.validity;
        }
        get validationMessage() {
          return this._internals.validationMessage;
        }
        get willValidate() {
          return this._internals.willValidate;
        }
        checkValidity() {
          return this._setValidityFromInput(), this._internals.checkValidity();
        }
        reportValidity() {
          return this._setValidityFromInput(), this._internals.reportValidity();
        }
        get wrappedElement() {
          return this._inputEl;
        }
        constructor() {
          super(), this.autocomplete = void 0, this.autofocus = false, this.defaultValue = "", this.disabled = false, this.focused = false, this.invalid = false, this.label = "", this.max = void 0, this.maxLength = void 0, this.min = void 0, this.minLength = void 0, this.multiple = false, this.name = void 0, this.pattern = void 0, this.placeholder = void 0, this.readonly = false, this.required = false, this.step = void 0, this._value = "", this._type = "text", this._internals = this.attachInternals();
        }
        connectedCallback() {
          super.connectedCallback(), this.updateComplete.then((() => {
            this._inputEl.checkValidity(), this._setValidityFromInput(), this._internals.setFormValue(this._inputEl.value);
          }));
        }
        attributeChangedCallback(t2, e2, i2) {
          super.attributeChangedCallback(t2, e2, i2);
          ["max", "maxlength", "min", "minlength", "pattern", "required", "step"].includes(t2) && this.updateComplete.then((() => {
            this._setValidityFromInput();
          }));
        }
        formResetCallback() {
          this.value = this.defaultValue, this.requestUpdate();
        }
        formStateRestoreCallback(t2, e2) {
          this.value = t2;
        }
        _dataChanged() {
          if (this._value = this._inputEl.value, "file" === this.type && this._inputEl.files) for (const t2 of this._inputEl.files) this._internals.setFormValue(t2);
          else this._internals.setFormValue(this._inputEl.value);
        }
        _setValidityFromInput() {
          this._inputEl && this._internals.setValidity(this._inputEl.validity, this._inputEl.validationMessage, this._inputEl);
        }
        _onInput() {
          this._dataChanged(), this._setValidityFromInput();
        }
        _onChange() {
          this._dataChanged(), this._setValidityFromInput(), this.dispatchEvent(new Event("change"));
        }
        _onFocus() {
          this.focused = true;
        }
        _onBlur() {
          this.focused = false;
        }
        _onKeyDown(t2) {
          "Enter" === t2.key && this._internals.form && this._internals.form?.requestSubmit();
        }
        render() {
          return U`
      <div class="root">
        <slot name="content-before"></slot>
        <input
          id="input"
          type=${this.type}
          ?autofocus=${this.autofocus}
          autocomplete=${Dt(this.autocomplete)}
          aria-label=${this.label}
          ?disabled=${this.disabled}
          max=${Dt(this.max)}
          maxlength=${Dt(this.maxLength)}
          min=${Dt(this.min)}
          minlength=${Dt(this.minLength)}
          ?multiple=${this.multiple}
          name=${Dt(this.name)}
          pattern=${Dt(this.pattern)}
          placeholder=${Dt(this.placeholder)}
          ?readonly=${this.readonly}
          ?required=${this.required}
          step=${Dt(this.step)}
          .value=${this._value}
          @blur=${this._onBlur}
          @change=${this._onChange}
          @focus=${this._onFocus}
          @input=${this._onInput}
          @keydown=${this._onKeyDown}
        />
        <slot name="content-after"></slot>
      </div>
    `;
        }
      };
      as.styles = ns, as.formAssociated = true, as.shadowRootOptions = { ...lt.shadowRootOptions, delegatesFocus: true }, hs([pt()], as.prototype, "autocomplete", void 0), hs([pt({ type: Boolean, reflect: true })], as.prototype, "autofocus", void 0), hs([pt({ attribute: "default-value" })], as.prototype, "defaultValue", void 0), hs([pt({ type: Boolean, reflect: true })], as.prototype, "disabled", void 0), hs([pt({ type: Boolean, reflect: true })], as.prototype, "focused", void 0), hs([pt({ type: Boolean, reflect: true })], as.prototype, "invalid", void 0), hs([pt({ attribute: false })], as.prototype, "label", void 0), hs([pt({ type: Number })], as.prototype, "max", void 0), hs([pt({ type: Number })], as.prototype, "maxLength", void 0), hs([pt({ type: Number })], as.prototype, "min", void 0), hs([pt({ type: Number })], as.prototype, "minLength", void 0), hs([pt({ type: Boolean, reflect: true })], as.prototype, "multiple", void 0), hs([pt({ reflect: true })], as.prototype, "name", void 0), hs([pt()], as.prototype, "pattern", void 0), hs([pt()], as.prototype, "placeholder", void 0), hs([pt({ type: Boolean, reflect: true })], as.prototype, "readonly", void 0), hs([pt({ type: Boolean, reflect: true })], as.prototype, "required", void 0), hs([pt({ type: Number })], as.prototype, "step", void 0), hs([pt({ reflect: true })], as.prototype, "type", null), hs([pt()], as.prototype, "value", null), hs([ft("#input")], as.prototype, "_inputEl", void 0), hs([vt()], as.prototype, "_value", void 0), hs([vt()], as.prototype, "_type", void 0), as = hs([$t("vscode-textfield")], as);
      ls = [_t, n`
    :host {
      display: inline-flex;
    }

    button {
      align-items: center;
      background-color: transparent;
      border: 0;
      border-radius: 5px;
      color: var(--vscode-foreground, #cccccc);
      cursor: pointer;
      display: flex;
      outline-offset: -1px;
      outline-width: 1px;
      padding: 0;
      user-select: none;
    }

    button:focus-visible {
      outline-color: var(--vscode-focusBorder, #0078d4);
      outline-style: solid;
    }

    button:hover {
      background-color: var(
        --vscode-toolbar-hoverBackground,
        rgba(90, 93, 94, 0.31)
      );
      outline-style: dashed;
      outline-color: var(--vscode-toolbar-hoverOutline, transparent);
    }

    button:active {
      background-color: var(
        --vscode-toolbar-activeBackground,
        rgba(99, 102, 103, 0.31)
      );
    }

    button.checked {
      background-color: var(
        --vscode-inputOption-activeBackground,
        rgba(36, 137, 219, 0.51)
      );
      outline-color: var(--vscode-inputOption-activeBorder, #2488db);
      outline-style: solid;
      color: var(--vscode-inputOption-activeForeground, #ffffff);
    }

    button.checked vscode-icon {
      color: var(--vscode-inputOption-activeForeground, #ffffff);
    }

    vscode-icon {
      display: block;
      padding: 3px;
    }

    slot:not(.empty) {
      align-items: center;
      display: flex;
      height: 22px;
      padding: 0 5px 0 2px;
    }

    slot.textOnly:not(.empty) {
      padding: 0 5px;
    }
  `];
      cs = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      ds = class extends kt {
        constructor() {
          super(...arguments), this.icon = "", this.label = void 0, this.toggleable = false, this.checked = false, this._isSlotEmpty = true;
        }
        _handleSlotChange() {
          this._isSlotEmpty = !((this._assignedNodes?.length ?? 0) > 0);
        }
        _handleButtonClick() {
          this.toggleable && (this.checked = !this.checked, this.dispatchEvent(new Event("change")));
        }
        render() {
          const t2 = this.checked ? "true" : "false";
          return U`
      <button
        type="button"
        aria-label=${Dt(this.label)}
        role=${Dt(this.toggleable ? "switch" : void 0)}
        aria-checked=${Dt(this.toggleable ? t2 : void 0)}
        class=${Mt({ checked: this.toggleable && this.checked })}
        @click=${this._handleButtonClick}
      >
        ${this.icon ? U`<vscode-icon name=${this.icon}></vscode-icon>` : q}
        <slot
          @slotchange=${this._handleSlotChange}
          class=${Mt({ empty: this._isSlotEmpty, textOnly: !this.icon })}
        ></slot>
      </button>
    `;
        }
      };
      ds.styles = ls, cs([pt({ reflect: true })], ds.prototype, "icon", void 0), cs([pt()], ds.prototype, "label", void 0), cs([pt({ type: Boolean, reflect: true })], ds.prototype, "toggleable", void 0), cs([pt({ type: Boolean, reflect: true })], ds.prototype, "checked", void 0), cs([vt()], ds.prototype, "_isSlotEmpty", void 0), cs([/* @__PURE__ */ (function(t2) {
        return (e2, i2) => {
          const { slot: s2 } = {}, o2 = "slot" + (s2 ? `[name=${s2}]` : ":not([name])");
          return bt(0, 0, { get() {
            const e3 = this.renderRoot?.querySelector(o2);
            return e3?.assignedNodes(t2) ?? [];
          } });
        };
      })()], ds.prototype, "_assignedNodes", void 0), ds = cs([$t("vscode-toolbar-button")], ds);
      us = [_t, n`
    :host {
      display: block;
    }

    div {
      gap: 4px;
      display: flex;
      align-items: center;
    }
  `];
      ps = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      vs = class extends kt {
        render() {
          return U`<div><slot></slot></div>`;
        }
      };
      vs.styles = us, vs = ps([$t("vscode-toolbar-container")], vs);
      bs = class extends Event {
        constructor(t2, e2, i2, s2) {
          super("context-request", { bubbles: true, composed: true }), this.context = t2, this.contextTarget = e2, this.callback = i2, this.subscribe = s2 ?? false;
        }
      };
      fs = class {
        constructor(t2, e2, i2, s2) {
          if (this.subscribe = false, this.provided = false, this.value = void 0, this.t = (t3, e3) => {
            this.unsubscribe && (this.unsubscribe !== e3 && (this.provided = false, this.unsubscribe()), this.subscribe || this.unsubscribe()), this.value = t3, this.host.requestUpdate(), this.provided && !this.subscribe || (this.provided = true, this.callback && this.callback(t3, e3)), this.unsubscribe = e3;
          }, this.host = t2, void 0 !== e2.context) {
            const t3 = e2;
            this.context = t3.context, this.callback = t3.callback, this.subscribe = t3.subscribe ?? false;
          } else this.context = e2, this.callback = i2, this.subscribe = s2 ?? false;
          this.host.addController(this);
        }
        hostConnected() {
          this.dispatchRequest();
        }
        hostDisconnected() {
          this.unsubscribe && (this.unsubscribe(), this.unsubscribe = void 0);
        }
        dispatchRequest() {
          this.host.dispatchEvent(new bs(this.context, this.host, this.t, this.subscribe));
        }
      };
      gs = class {
        get value() {
          return this.o;
        }
        set value(t2) {
          this.setValue(t2);
        }
        setValue(t2, e2 = false) {
          const i2 = e2 || !Object.is(t2, this.o);
          this.o = t2, i2 && this.updateObservers();
        }
        constructor(t2) {
          this.subscriptions = /* @__PURE__ */ new Map(), this.updateObservers = () => {
            for (const [t3, { disposer: e2 }] of this.subscriptions) t3(this.o, e2);
          }, void 0 !== t2 && (this.value = t2);
        }
        addCallback(t2, e2, i2) {
          if (!i2) return void t2(this.value);
          this.subscriptions.has(t2) || this.subscriptions.set(t2, { disposer: () => {
            this.subscriptions.delete(t2);
          }, consumerHost: e2 });
          const { disposer: s2 } = this.subscriptions.get(t2);
          t2(this.value, s2);
        }
        clearCallbacks() {
          this.subscriptions.clear();
        }
      };
      ms = class extends Event {
        constructor(t2, e2) {
          super("context-provider", { bubbles: true, composed: true }), this.context = t2, this.contextTarget = e2;
        }
      };
      xs = class extends gs {
        constructor(t2, e2, i2) {
          super(void 0 !== e2.context ? e2.initialValue : i2), this.onContextRequest = (t3) => {
            if (t3.context !== this.context) return;
            const e3 = t3.contextTarget ?? t3.composedPath()[0];
            e3 !== this.host && (t3.stopPropagation(), this.addCallback(t3.callback, e3, t3.subscribe));
          }, this.onProviderRequest = (t3) => {
            if (t3.context !== this.context) return;
            if ((t3.contextTarget ?? t3.composedPath()[0]) === this.host) return;
            const e3 = /* @__PURE__ */ new Set();
            for (const [t4, { consumerHost: i3 }] of this.subscriptions) e3.has(t4) || (e3.add(t4), i3.dispatchEvent(new bs(this.context, i3, t4, true)));
            t3.stopPropagation();
          }, this.host = t2, void 0 !== e2.context ? this.context = e2.context : this.context = e2, this.attachListeners(), this.host.addController?.(this);
        }
        attachListeners() {
          this.host.addEventListener("context-request", this.onContextRequest), this.host.addEventListener("context-provider", this.onProviderRequest);
        }
        hostConnected() {
          this.host.dispatchEvent(new ms(this.context, this.host));
        }
      };
      ks = [_t, n`
    :host {
      --vsc-tree-item-arrow-display: flex;
      --internal-selectionBackground: var(
        --vscode-list-inactiveSelectionBackground,
        #37373d
      );
      --internal-selectionForeground: var(--vscode-foreground, #cccccc);
      --internal-selectionIconForeground: var(
        --vscode-icon-foreground,
        #cccccc
      );
      --internal-defaultIndentGuideDisplay: none;
      --internal-highlightedIndentGuideDisplay: block;

      display: block;
    }

    :host(:hover) {
      --internal-defaultIndentGuideDisplay: block;
      --internal-highlightedIndentGuideDisplay: block;
    }

    :host(:focus-within) {
      --internal-selectionBackground: var(
        --vscode-list-activeSelectionBackground,
        #04395e
      );
      --internal-selectionForeground: var(
        --vscode-list-activeSelectionForeground,
        #ffffff
      );
      --internal-selectionIconForeground: var(
        --vscode-list-activeSelectionIconForeground,
        #ffffff
      );
    }

    :host([hide-arrows]) {
      --vsc-tree-item-arrow-display: none;
    }

    :host([indent-guides='none']),
    :host([indent-guides='none']:hover) {
      --internal-defaultIndentGuideDisplay: none;
      --internal-highlightedIndentGuideDisplay: none;
    }

    :host([indent-guides='always']),
    :host([indent-guides='always']:hover) {
      --internal-defaultIndentGuideDisplay: block;
      --internal-highlightedIndentGuideDisplay: block;
    }
  `];
      $s = "vscode-list";
      _s = /* @__PURE__ */ Symbol("configContext");
      Ss = (t2) => t2 instanceof Element && t2.matches("vscode-tree-item");
      Cs = (t2, e2) => {
        const i2 = e2.length, s2 = (o2 = t2) instanceof Element && o2.matches("vscode-tree") ? -1 : t2.level;
        var o2;
        "branch" in t2 && (t2.branch = i2 > 0), e2.forEach(((e3, i3) => {
          e3.path = "path" in t2 ? [...t2.path, i3] : [i3], e3.level = s2 + 1, e3.dataset.path = e3.path.join(".");
        }));
      };
      Bs = (t2) => {
        const e2 = t2.lastElementChild;
        return e2 && Ss(e2) ? e2.branch && e2.open ? Bs(e2) : e2 : t2;
      };
      As = (t2) => {
        if (!t2.parentElement) return null;
        if (!Ss(t2.parentElement)) return null;
        const e2 = Os(t2.parentElement);
        return e2 || As(t2.parentElement);
      };
      Os = (t2) => {
        let e2 = t2.nextElementSibling;
        for (; e2 && !Ss(e2); ) e2 = e2.nextElementSibling;
        return e2;
      };
      Es = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      Is = "singleClick";
      js = "doubleClick";
      Ms = "none";
      Ds = [" ", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Enter", "Escape", "Shift"];
      Fs = class extends kt {
        constructor() {
          super(), this.expandMode = "singleClick", this.hideArrows = false, this.indent = 8, this.indentGuides = "onHover", this.multiSelect = false, this._treeContextState = { isShiftPressed: false, activeItem: null, selectedItems: /* @__PURE__ */ new Set(), hoveredItem: null, allItems: null, itemListUpToDate: false, focusedItem: null, prevFocusedItem: null, hasBranchItem: false, rootElement: this, highlightedItems: /* @__PURE__ */ new Set(), highlightIndentGuides: () => {
            this._highlightIndentGuides();
          }, emitSelectEvent: () => {
            this._emitSelectEvent();
          } }, this._configContext = { hideArrows: this.hideArrows, expandMode: this.expandMode, indent: this.indent, indentGuides: this.indentGuides, multiSelect: this.multiSelect }, this._handleComponentKeyDown = (t2) => {
            const e2 = t2.key;
            switch (Ds.includes(e2) && (t2.stopPropagation(), t2.preventDefault()), e2) {
              case " ":
              case "Enter":
                this._handleEnterPress();
                break;
              case "ArrowDown":
                this._handleArrowDownPress();
                break;
              case "ArrowLeft":
                this._handleArrowLeftPress(t2);
                break;
              case "ArrowRight":
                this._handleArrowRightPress();
                break;
              case "ArrowUp":
                this._handleArrowUpPress();
                break;
              case "Shift":
                this._handleShiftPress();
            }
          }, this._handleComponentKeyUp = (t2) => {
            "Shift" === t2.key && (this._treeContextState.isShiftPressed = false);
          }, this._handleSlotChange = () => {
            this._treeContextState.itemListUpToDate = false, Cs(this, this._assignedTreeItems), this.updateComplete.then((() => {
              if (null === this._treeContextState.activeItem) {
                const t2 = this.querySelector(":scope > vscode-tree-item");
                t2 && (t2.active = true);
              }
            }));
          }, this.addEventListener("keyup", this._handleComponentKeyUp), this.addEventListener("keydown", this._handleComponentKeyDown);
        }
        connectedCallback() {
          super.connectedCallback(), this.role = "tree";
        }
        willUpdate(t2) {
          this._updateConfigContext(t2), t2.has("multiSelect") && (this.ariaMultiSelectable = this.multiSelect ? "true" : "false");
        }
        expandAll() {
          this.querySelectorAll("vscode-tree-item").forEach(((t2) => {
            t2.branch && (t2.open = true);
          }));
        }
        collapseAll() {
          this.querySelectorAll("vscode-tree-item").forEach(((t2) => {
            t2.branch && (t2.open = false);
          }));
        }
        updateHasBranchItemFlag() {
          const t2 = this._assignedTreeItems.some(((t3) => t3.branch));
          this._treeContextState = { ...this._treeContextState, hasBranchItem: t2 };
        }
        _emitSelectEvent() {
          const t2 = new CustomEvent("vsc-tree-select", { detail: Array.from(this._treeContextState.selectedItems) });
          this.dispatchEvent(t2);
        }
        _highlightIndentGuideOfItem(t2) {
          if (t2.branch && t2.open) t2.highlightedGuides = true, this._treeContextState.highlightedItems?.add(t2);
          else {
            const e2 = zs(t2);
            e2 && (e2.highlightedGuides = true, this._treeContextState.highlightedItems?.add(e2));
          }
        }
        _highlightIndentGuides() {
          this.indentGuides !== Ms && (this._treeContextState.highlightedItems?.forEach(((t2) => t2.highlightedGuides = false)), this._treeContextState.highlightedItems?.clear(), this._treeContextState.activeItem && this._highlightIndentGuideOfItem(this._treeContextState.activeItem), this._treeContextState.selectedItems.forEach(((t2) => {
            this._highlightIndentGuideOfItem(t2);
          })));
        }
        _updateConfigContext(t2) {
          const { hideArrows: e2, expandMode: i2, indent: s2, indentGuides: o2, multiSelect: r2 } = this;
          t2.has("hideArrows") && (this._configContext = { ...this._configContext, hideArrows: e2 }), t2.has("expandMode") && (this._configContext = { ...this._configContext, expandMode: i2 }), t2.has("indent") && (this._configContext = { ...this._configContext, indent: s2 }), t2.has("indentGuides") && (this._configContext = { ...this._configContext, indentGuides: o2 }), t2.has("multiSelect") && (this._configContext = { ...this._configContext, multiSelect: r2 });
        }
        _focusItem(t2) {
          t2.active = true, t2.updateComplete.then((() => {
            t2.focus(), this._highlightIndentGuides();
          }));
        }
        _focusPrevItem() {
          if (this._treeContextState.focusedItem) {
            const t2 = ((t3) => {
              const { parentElement: e2 } = t3;
              if (!e2 || !Ss(t3)) return null;
              let i2 = t3.previousElementSibling;
              for (; i2 && !Ss(i2); ) i2 = i2.previousElementSibling;
              if (!i2 && Ss(e2)) return e2;
              if (i2 && i2.branch && i2.open) return Bs(i2);
              return i2;
            })(this._treeContextState.focusedItem);
            t2 && (this._focusItem(t2), this._treeContextState.isShiftPressed && this.multiSelect && (t2.selected = !t2.selected, this._emitSelectEvent()));
          }
        }
        _focusNextItem() {
          if (this._treeContextState.focusedItem) {
            const t2 = ((t3) => {
              const { parentElement: e2 } = t3;
              if (!e2 || !Ss(t3)) return null;
              let i2;
              if (t3.branch && t3.open) {
                const e3 = t3.querySelector("vscode-tree-item");
                e3 ? i2 = e3 : (i2 = Os(t3), i2 || (i2 = As(t3)));
              } else i2 = Os(t3), i2 || (i2 = As(t3));
              return i2 || t3;
            })(this._treeContextState.focusedItem);
            t2 && (this._focusItem(t2), this._treeContextState.isShiftPressed && this.multiSelect && (t2.selected = !t2.selected, this._emitSelectEvent()));
          }
        }
        _handleArrowRightPress() {
          if (!this._treeContextState.focusedItem) return;
          const { focusedItem: t2 } = this._treeContextState;
          t2.branch && (t2.open ? this._focusNextItem() : t2.open = true);
        }
        _handleArrowLeftPress(t2) {
          if (t2.ctrlKey) return void this.collapseAll();
          if (!this._treeContextState.focusedItem) return;
          const { focusedItem: e2 } = this._treeContextState, i2 = zs(e2);
          e2.branch && e2.open ? e2.open = false : i2 && i2.branch && this._focusItem(i2);
        }
        _handleArrowDownPress() {
          this._treeContextState.focusedItem ? this._focusNextItem() : this._focusItem(this._assignedTreeItems[0]);
        }
        _handleArrowUpPress() {
          this._treeContextState.focusedItem ? this._focusPrevItem() : this._focusItem(this._assignedTreeItems[0]);
        }
        _handleEnterPress() {
          const { focusedItem: t2 } = this._treeContextState;
          t2 && (this._treeContextState.selectedItems.forEach(((t3) => t3.selected = false)), this._treeContextState.selectedItems.clear(), this._highlightIndentGuides(), t2.selected = true, this._emitSelectEvent(), t2.branch && (t2.open = !t2.open));
        }
        _handleShiftPress() {
          this._treeContextState.isShiftPressed = true;
        }
        render() {
          return U`<div>
      <slot @slotchange=${this._handleSlotChange}></slot>
    </div>`;
        }
      };
      Fs.styles = ks, Es([pt({ type: String, attribute: "expand-mode" })], Fs.prototype, "expandMode", void 0), Es([pt({ type: Boolean, reflect: true, attribute: "hide-arrows" })], Fs.prototype, "hideArrows", void 0), Es([pt({ type: Number, reflect: true })], Fs.prototype, "indent", void 0), Es([pt({ type: String, attribute: "indent-guides", useDefault: true, reflect: true })], Fs.prototype, "indentGuides", void 0), Es([pt({ type: Boolean, reflect: true, attribute: "multi-select" })], Fs.prototype, "multiSelect", void 0), Es([ws({ context: $s })], Fs.prototype, "_treeContextState", void 0), Es([ws({ context: _s })], Fs.prototype, "_configContext", void 0), Es([mt({ selector: "vscode-tree-item" })], Fs.prototype, "_assignedTreeItems", void 0), Fs = Es([$t("vscode-tree")], Fs);
      Ps = [_t, n`
    :host {
      --hover-outline-color: transparent;
      --hover-outline-style: solid;
      --hover-outline-width: 0;

      --selected-outline-color: transparent;
      --selected-outline-style: solid;
      --selected-outline-width: 0;

      cursor: pointer;
      display: block;
      user-select: none;
    }

    ::slotted(vscode-icon) {
      display: block;
    }

    .root {
      display: block;
    }

    .wrapper {
      align-items: flex-start;
      color: var(--vscode-foreground, #cccccc);
      display: flex;
      flex-wrap: nowrap;
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      font-weight: var(--vscode-font-weight, normal);
      line-height: 22px;
      min-height: 22px;
      outline-offset: -1px;
      padding-right: 12px;
    }

    .wrapper:hover {
      background-color: var(--vscode-list-hoverBackground, #2a2d2e);
      color: var(
        --vscode-list-hoverForeground,
        var(--vscode-foreground, #cccccc)
      );
    }

    :host([selected]) .wrapper {
      color: var(--internal-selectionForeground);
      background-color: var(--internal-selectionBackground);
    }

    :host([selected]) ::slotted(vscode-icon) {
      color: var(--internal-selectionForeground);
    }

    :host(:focus) {
      outline: none;
    }

    :host(:focus) .wrapper.active {
      outline-color: var(
        --vscode-list-focusAndSelectionOutline,
        var(--vscode-list-focusOutline, #0078d4)
      );
      outline-style: solid;
      outline-width: 1px;
    }

    .arrow-container {
      align-items: center;
      display: var(--vsc-tree-item-arrow-display);
      height: 22px;
      justify-content: center;
      padding-left: 8px;
      padding-right: 6px;
      width: 16px;
    }

    .arrow-container svg {
      display: block;
      fill: var(--vscode-icon-foreground, #cccccc);
    }

    .arrow-container.icon-rotated svg {
      transform: rotate(90deg);
    }

    :host([selected]) .arrow-container svg {
      fill: var(--internal-selectionIconForeground);
    }

    .icon-container {
      align-items: center;
      display: flex;
      justify-content: center;
      margin-right: 3px;
      min-height: 22px;
      overflow: hidden;
    }

    .icon-container slot {
      display: block;
    }

    .icon-container.has-icon {
      min-width: 22px;
      max-width: 22px;
      max-height: 22px;
    }

    :host(:is(:--show-actions, :state(show-actions))) .icon-container {
      overflow: visible;
    }

    .children {
      position: relative;
    }

    .children.guide:before {
      background-color: var(
        --vscode-tree-inactiveIndentGuidesStroke,
        rgba(88, 88, 88, 0.4)
      );
      content: '';
      display: none;
      height: 100%;
      left: var(--indentation-guide-left);
      pointer-events: none;
      position: absolute;
      width: 1px;
      z-index: 1;
    }

    .children.guide.default-guide:before {
      display: var(--internal-defaultIndentGuideDisplay);
    }

    .children.guide.highlighted-guide:before {
      display: var(--internal-highlightedIndentGuideDisplay);
      background-color: var(--vscode-tree-indentGuidesStroke, #585858);
    }

    .content {
      display: flex;
      align-items: center;
      flex-wrap: nowrap; /* prevent wrapping; allow ellipses via min-width: 0 */
      min-width: 0;
      width: 100%;
      line-height: 22px;
    }

    .label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex: 0 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .description {
      color: var(--vscode-foreground, #cccccc);
      opacity: 0.7;
      display: none;
      flex: 0 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .content.has-description .description {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      flex: 1 1 0%; /* description takes remaining space, yields first when shrinking */
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-left: 0.5em;
    }

    .content.has-description .label {
      flex: 0 1 auto; /* label only grows when description missing */
    }

    .content:not(.has-description) .label {
      flex: 1 1 auto;
    }

    .label ::slotted(*) {
      display: inline-block;
      max-width: 100%;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .description ::slotted(*) {
      display: inline-block;
      max-width: 100%;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .actions {
      align-items: center;
      align-self: center;
      display: none;
      flex: 0 0 auto;
      gap: 2px;
      margin-left: auto;
      min-height: 22px;
      color: inherit;
    }

    .actions ::slotted(*) {
      align-items: center;
      display: inline-flex;
      height: 22px;
    }

    .actions ::slotted(button) {
      cursor: pointer;
    }

    .actions ::slotted([hidden]) {
      display: none !important;
    }

    :host(
        :is(
          :--has-actions:--show-actions,
          :--has-actions:state(show-actions),
          :state(has-actions):--show-actions,
          :state(has-actions):state(show-actions)
        )
      )
      .actions {
      display: inline-flex;
    }

    .decoration {
      align-items: center;
      align-self: center;
      color: inherit;
      display: none;
      flex: 0 0 auto;
      gap: 4px;
      margin-left: auto;
      min-height: 22px;
    }

    :host(:is(:--has-decoration, :state(has-decoration))) .decoration {
      display: inline-flex;
    }

    :host(:is(:--show-actions, :state(show-actions))) .decoration {
      margin-left: 6px;
    }

    :host([selected]) ::slotted([slot='decoration']),
    :host([selected]) ::slotted([slot='decoration']) * {
      color: inherit !important;
    }

    :host([selected]) .description {
      color: var(--internal-selectionForeground, #ffffff);
      opacity: 0.8;
    }

    :host([selected]) :is(:state(focus-visible), :--focus-visible) .description,
    :host([selected]:focus-within) .description {
      opacity: 0.95;
    }

    :host([branch]) ::slotted(vscode-tree-item) {
      display: none;
    }

    :host([branch][open]) ::slotted(vscode-tree-item) {
      display: block;
    }
  `];
      Ns = function(t2, e2, i2, s2) {
        for (var o2, r2 = arguments.length, n2 = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2, h2 = t2.length - 1; h2 >= 0; h2--) (o2 = t2[h2]) && (n2 = (r2 < 3 ? o2(n2) : r2 > 3 ? o2(e2, i2, n2) : o2(e2, i2)) || n2);
        return r2 > 3 && n2 && Object.defineProperty(e2, i2, n2), n2;
      };
      Ts = U`<svg
  width="16"
  height="16"
  viewBox="0 0 16 16"
  xmlns="http://www.w3.org/2000/svg"
>
  <path
    fill-rule="evenodd"
    clip-rule="evenodd"
    d="M10.072 8.024L5.715 3.667l.618-.62L11 7.716v.618L6.333 13l-.618-.619 4.357-4.357z"
  />
</svg>`;
      Ls = Vs = class extends kt {
        set selected(t2) {
          this._selected = t2, t2 ? this._treeContextState.selectedItems.add(this) : this._treeContextState.selectedItems.delete(this), this.ariaSelected = t2 ? "true" : "false", this._updateActionsVisibility();
        }
        get selected() {
          return this._selected;
        }
        set path(t2) {
          this._path = t2;
        }
        get path() {
          return this._path;
        }
        constructor() {
          super(), this.active = false, this.branch = false, this.hasActiveItem = false, this.hasSelectedItem = false, this.highlightedGuides = false, this.open = false, this.level = 0, this._selected = false, this._path = [], this._hasBranchIcon = false, this._hasBranchOpenedIcon = false, this._hasLeafIcon = false, this._hasDescriptionSlotContent = false, this._hasActionsSlotContent = false, this._hasDecorationSlotContent = false, this._treeContextState = { isShiftPressed: false, selectedItems: /* @__PURE__ */ new Set(), hoveredItem: null, allItems: null, itemListUpToDate: false, focusedItem: null, prevFocusedItem: null, hasBranchItem: false, rootElement: null, activeItem: null }, this._isPointerInside = false, this._hasKeyboardFocus = false, this._handleMainSlotChange = () => {
            this._mainSlotChange(), this._treeContextState.itemListUpToDate = false;
          }, this._handleComponentFocus = () => {
            this._treeContextState.focusedItem && this._treeContextState.focusedItem !== this && (this._treeContextState.isShiftPressed || (this._treeContextState.prevFocusedItem = this._treeContextState.focusedItem), this._treeContextState.focusedItem = null), this._treeContextState.focusedItem = this;
          }, this._handlePointerEnter = () => {
            this._isPointerInside = true, this._claimHover();
          }, this._handlePointerLeave = (t2) => {
            this._isPointerInside = false, this._treeContextState.hoveredItem === this && (this._treeContextState.hoveredItem = null), this._clearHoverState();
            const e2 = t2.relatedTarget;
            if (e2 instanceof Element) {
              const t3 = e2.closest("vscode-tree-item");
              t3 && t3 !== this && t3.isConnected && t3._adoptHoverFromSibling();
            }
          }, this._handleFocusIn = () => {
            this._updateFocusState();
          }, this._handleFocusOut = () => {
            this._updateFocusState();
          }, this._internals = this.attachInternals(), this.addEventListener("focus", this._handleComponentFocus), this.addEventListener("pointerenter", this._handlePointerEnter), this.addEventListener("pointerleave", this._handlePointerLeave), this.addEventListener("focusin", this._handleFocusIn), this.addEventListener("focusout", this._handleFocusOut);
        }
        connectedCallback() {
          super.connectedCallback(), this._mainSlotChange(), this.role = "treeitem", this.ariaDisabled = "false";
        }
        firstUpdated(t2) {
          super.firstUpdated(t2), this._refreshDescriptionSlotState(), this._refreshActionsSlotState(), this._refreshDecorationSlotState(), this.matches(":hover") ? (this._isPointerInside = true, this._claimHover()) : this._updateActionsVisibility();
        }
        willUpdate(t2) {
          t2.has("active") && this._toggleActiveState(), (t2.has("open") || t2.has("branch")) && this._setAriaExpanded();
        }
        _setAriaExpanded() {
          this.branch ? this.ariaExpanded = this.open ? "true" : "false" : this.ariaExpanded = null;
        }
        _setHasActiveItemFlagOnParent(t2, e2) {
          const i2 = Rs(t2);
          i2 && (i2.hasActiveItem = e2);
        }
        _refreshDescriptionSlotState() {
          const t2 = (this._descriptionSlotElements?.length ?? 0) > 0;
          this._hasDescriptionSlotContent = t2, this._setCustomState("has-description", t2);
        }
        _refreshActionsSlotState() {
          const t2 = (this._actionsSlotElements?.length ?? 0) > 0;
          this._hasActionsSlotContent = t2, this._setCustomState("has-actions", t2), this._updateActionsVisibility();
        }
        _refreshDecorationSlotState() {
          const t2 = (this._decorationSlotElements?.length ?? 0) > 0, e2 = this._hasDecorationSlotContent;
          this._hasDecorationSlotContent = t2, this._setCustomState("has-decoration", t2), e2 !== t2 && this.requestUpdate();
        }
        _setCustomState(t2, e2) {
          if (this._internals?.states) try {
            e2 ? this._internals.states.add(t2) : this._internals.states.delete(t2);
          } catch {
            e2 ? this._internals.states.add(`--${t2}`) : this._internals.states.delete(`--${t2}`);
          }
        }
        _getActiveElement() {
          const t2 = this.getRootNode({ composed: true });
          return t2 instanceof Document ? t2.activeElement instanceof Element ? t2.activeElement : null : t2 instanceof ShadowRoot && t2.activeElement instanceof Element ? t2.activeElement : null;
        }
        _isActiveElementInActions(t2) {
          return !!t2 && (this._actionsSlotElements ?? []).some(((e2) => e2 === t2 || e2.contains(t2)));
        }
        _updateActionsVisibility() {
          if (!this._hasActionsSlotContent) return void this._setCustomState("show-actions", false);
          const t2 = this._getActiveElement(), e2 = this._isActiveElementInActions(t2), i2 = this.selected || this._isPointerInside || this._hasKeyboardFocus || e2;
          this._setCustomState("show-actions", i2);
        }
        _updateFocusState() {
          const t2 = this.matches(":focus-visible");
          this._setCustomState("focus-visible", t2);
          const e2 = this._getActiveElement();
          let i2 = null;
          if (e2 instanceof Element && (i2 = e2.closest("vscode-tree-item"), !i2)) {
            const t3 = e2.getRootNode();
            t3 instanceof ShadowRoot && t3.host instanceof Vs && (i2 = t3.host);
          }
          const s2 = i2 === this;
          this._hasKeyboardFocus = s2, this._setCustomState("keyboard-focus", s2), this._updateActionsVisibility();
        }
        _clearHoverState() {
          this._isPointerInside = false, this._setCustomState("hover", false), this._updateActionsVisibility();
        }
        _adoptHoverFromSibling() {
          this._isPointerInside = true, this._claimHover();
        }
        _claimHover() {
          const t2 = this._treeContextState;
          t2.hoveredItem && t2.hoveredItem !== this && t2.hoveredItem._clearHoverState(), t2.hoveredItem = this, this._setCustomState("hover", true), this._updateActionsVisibility();
        }
        _toggleActiveState() {
          this.active ? (this._treeContextState.activeItem && (this._treeContextState.activeItem.active = false, this._setHasActiveItemFlagOnParent(this._treeContextState.activeItem, false)), this._treeContextState.activeItem = this, this._setHasActiveItemFlagOnParent(this, true), this.tabIndex = 0, this._setCustomState("active", true)) : (this._treeContextState.activeItem === this && (this._treeContextState.activeItem = null, this._setHasActiveItemFlagOnParent(this, false)), this.tabIndex = -1, this._setCustomState("active", false));
        }
        _selectItem(t2) {
          const { selectedItems: e2 } = this._treeContextState, { multiSelect: i2 } = this._configContext, s2 = new Set(e2);
          i2 && t2 ? this.selected = !this.selected : (Array.from(e2).forEach(((t3) => {
            t3 !== this && (t3.selected = false);
          })), e2.clear(), this.selected = true);
          const o2 = /* @__PURE__ */ new Set([...s2, ...e2]);
          o2.add(this), o2.forEach(((t3) => t3._updateActionsVisibility()));
        }
        _selectRange() {
          const t2 = this._treeContextState.prevFocusedItem;
          if (!t2 || t2 === this) return;
          const e2 = new Set(this._treeContextState.selectedItems);
          this._treeContextState.itemListUpToDate || (this._treeContextState.allItems = this._treeContextState.rootElement.querySelectorAll("vscode-tree-item"), this._treeContextState.allItems && this._treeContextState.allItems.forEach(((t3, e3) => {
            t3.dataset.score = e3.toString();
          })), this._treeContextState.itemListUpToDate = true);
          let i2 = +(t2.dataset.score ?? -1), s2 = +(this.dataset.score ?? -1);
          i2 > s2 && ([i2, s2] = [s2, i2]), Array.from(this._treeContextState.selectedItems).forEach(((t3) => t3.selected = false)), this._treeContextState.selectedItems.clear(), this._selectItemsAndAllVisibleDescendants(i2, s2);
          const o2 = /* @__PURE__ */ new Set([...e2, ...this._treeContextState.selectedItems]);
          o2.add(this), o2.forEach(((t3) => t3._updateActionsVisibility()));
        }
        _selectItemsAndAllVisibleDescendants(t2, e2) {
          let i2 = t2;
          for (; i2 <= e2; ) if (this._treeContextState.allItems) {
            const t3 = this._treeContextState.allItems[i2];
            if (t3.branch && !t3.open) {
              t3.selected = true;
              i2 += t3.querySelectorAll("vscode-tree-item").length;
            } else t3.branch && t3.open ? (t3.selected = true, i2 += this._selectItemsAndAllVisibleDescendants(i2 + 1, e2)) : (t3.selected = true, i2 += 1);
          }
          return i2;
        }
        _mainSlotChange() {
          this._initiallyAssignedTreeItems.forEach(((t2) => {
            t2.setAttribute("slot", "children");
          }));
        }
        _handleChildrenSlotChange() {
          Cs(this, this._childrenTreeItems), this._treeContextState.rootElement && this._treeContextState.rootElement.updateHasBranchItemFlag();
        }
        _handleDescriptionSlotChange() {
          this._refreshDescriptionSlotState();
        }
        _handleActionsSlotChange() {
          this._refreshActionsSlotState();
        }
        _handleDecorationSlotChange() {
          this._refreshDecorationSlotState();
        }
        _handleContentClick(t2) {
          t2.stopPropagation();
          const e2 = t2.ctrlKey || t2.metaKey, i2 = t2.shiftKey;
          i2 && this._configContext.multiSelect ? (this._selectRange(), this._treeContextState.emitSelectEvent?.(), this.updateComplete.then((() => {
            this._treeContextState.highlightIndentGuides?.();
          }))) : (this._selectItem(e2), this._treeContextState.emitSelectEvent?.(), this.updateComplete.then((() => {
            this._treeContextState.highlightIndentGuides?.();
          })), this._configContext.expandMode === Is && (!this.branch || this._configContext.multiSelect && e2 || (this.open = !this.open))), this.active = true, i2 || (this._treeContextState.prevFocusedItem = this);
        }
        _handleDoubleClick(t2) {
          this._configContext.expandMode === js && (!this.branch || this._configContext.multiSelect && (t2.ctrlKey || t2.metaKey) || (this.open = !this.open));
        }
        _handleIconSlotChange(t2) {
          const e2 = t2.target, i2 = e2.assignedElements().length > 0;
          switch (e2.name) {
            case "icon-branch":
              this._hasBranchIcon = i2;
              break;
            case "icon-branch-opened":
              this._hasBranchOpenedIcon = i2;
              break;
            case "icon-leaf":
              this._hasLeafIcon = i2;
          }
        }
        render() {
          const { hideArrows: t2, indent: e2, indentGuides: i2 } = this._configContext, { hasBranchItem: s2 } = this._treeContextState;
          let o2 = 3 + this.level * e2;
          const r2 = t2 ? 3 : 13, n2 = 3 + this.level * e2 + r2;
          this.branch || t2 || !s2 || (o2 += 30);
          const h2 = this._hasBranchIcon && this.branch || this._hasBranchOpenedIcon && this.branch && this.open || this._hasLeafIcon && !this.branch, a2 = { wrapper: true, active: this.active, "has-description": this._hasDescriptionSlotContent, "has-actions": this._hasActionsSlotContent, "has-decoration": this._hasDecorationSlotContent }, l2 = { children: true, guide: i2 !== Ms, "default-guide": i2 !== Ms, "highlighted-guide": this.highlightedGuides }, c2 = { "icon-container": true, "has-icon": h2 }, d2 = { content: true, "has-description": this._hasDescriptionSlotContent, "has-decoration": this._hasDecorationSlotContent };
          return U` <div class="root">
      <div
        class=${Mt(a2)}
        part="wrapper"
        @click=${this._handleContentClick}
        @dblclick=${this._handleDoubleClick}
        .style=${Ft({ paddingLeft: `${o2}px` })}
      >
        ${this.branch && !t2 ? U`<div
              class=${Mt({ "arrow-container": true, "icon-rotated": this.open })}
              part="arrow-icon-container"
            >
              ${Ts}
            </div>` : q}
        <div class=${Mt(c2)} part="icon-container">
          ${this.branch && !this.open ? U`<slot
                name="icon-branch"
                @slotchange=${this._handleIconSlotChange}
              ></slot>` : q}
          ${this.branch && this.open ? U`<slot
                name="icon-branch-opened"
                @slotchange=${this._handleIconSlotChange}
              ></slot>` : q}
          ${this.branch ? q : U`<slot
                name="icon-leaf"
                @slotchange=${this._handleIconSlotChange}
              ></slot>`}
        </div>
        <div class=${Mt(d2)} part="content">
          <span class="label" part="label">
            <slot @slotchange=${this._handleMainSlotChange}></slot>
          </span>
          <span
            class="description"
            part="description"
            ?hidden=${!this._hasDescriptionSlotContent}
          >
            <slot
              name="description"
              @slotchange=${this._handleDescriptionSlotChange}
            ></slot>
          </span>
          <div class="actions" part="actions">
            <slot
              name="actions"
              @slotchange=${this._handleActionsSlotChange}
            ></slot>
          </div>
          <div class="decoration" part="decoration">
            <slot
              name="decoration"
              @slotchange=${this._handleDecorationSlotChange}
            ></slot>
          </div>
        </div>
      </div>
      <div
        class=${Mt(l2)}
        .style=${Ft({ "--indentation-guide-left": `${n2}px` })}
        role="group"
        part="children"
      >
        <slot
          name="children"
          @slotchange=${this._handleChildrenSlotChange}
        ></slot>
      </div>
    </div>`;
        }
      };
      Ls.styles = Ps, Ns([pt({ type: Boolean })], Ls.prototype, "active", void 0), Ns([pt({ type: Boolean, reflect: true })], Ls.prototype, "branch", void 0), Ns([pt({ type: Boolean })], Ls.prototype, "hasActiveItem", void 0), Ns([pt({ type: Boolean })], Ls.prototype, "hasSelectedItem", void 0), Ns([pt({ type: Boolean })], Ls.prototype, "highlightedGuides", void 0), Ns([pt({ type: Boolean, reflect: true })], Ls.prototype, "open", void 0), Ns([pt({ type: Number, reflect: true })], Ls.prototype, "level", void 0), Ns([pt({ type: Boolean, reflect: true })], Ls.prototype, "selected", null), Ns([vt()], Ls.prototype, "_hasBranchIcon", void 0), Ns([vt()], Ls.prototype, "_hasBranchOpenedIcon", void 0), Ns([vt()], Ls.prototype, "_hasLeafIcon", void 0), Ns([vt()], Ls.prototype, "_hasDescriptionSlotContent", void 0), Ns([vt()], Ls.prototype, "_hasActionsSlotContent", void 0), Ns([vt()], Ls.prototype, "_hasDecorationSlotContent", void 0), Ns([ys({ context: $s, subscribe: true })], Ls.prototype, "_treeContextState", void 0), Ns([ys({ context: _s, subscribe: true })], Ls.prototype, "_configContext", void 0), Ns([mt({ selector: "vscode-tree-item" })], Ls.prototype, "_initiallyAssignedTreeItems", void 0), Ns([mt({ selector: "vscode-tree-item", slot: "children" })], Ls.prototype, "_childrenTreeItems", void 0), Ns([mt({ slot: "description", flatten: true })], Ls.prototype, "_descriptionSlotElements", void 0), Ns([mt({ slot: "actions", flatten: true })], Ls.prototype, "_actionsSlotElements", void 0), Ns([mt({ slot: "decoration", flatten: true })], Ls.prototype, "_decorationSlotElements", void 0), Ls = Vs = Ns([$t("vscode-tree-item")], Ls);
    }
  });

  // ../../src/webviews/client/dom.ts
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === void 0 || value === false) continue;
      if (value === true) {
        node.setAttribute(key, "");
        continue;
      }
      node.setAttribute(key, String(value));
    }
    append(node, children);
    return node;
  }
  function append(parent, children) {
    for (const child of children) {
      if (child === void 0 || child === null) continue;
      parent.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
  }
  function escapeHtml(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function section(title, ...children) {
    const wrap = el("section", { class: "section" });
    wrap.appendChild(el("h2", {}, title));
    append(wrap, children);
    return wrap;
  }
  function badge(label, variant) {
    return el("span", { class: `badge ${variant}` }, label);
  }
  function banner(level, ...children) {
    const node = el("div", { class: `banner ${level}` });
    const icon = {
      info: "info",
      warning: "warning",
      error: "error",
      success: "pass"
    }[level];
    node.appendChild(el("span", { class: `codicon codicon-${icon}` }));
    const body = el("div", { style: "flex:1;min-width:0" });
    append(body, children);
    node.appendChild(body);
    return node;
  }
  function button(label, onClick, options = {}) {
    const attrs = { title: options.title };
    if (options.secondary) attrs.secondary = true;
    if (options.disabled) attrs.disabled = true;
    if (options.icon) attrs.icon = options.icon;
    const node = el("vscode-button", attrs, label);
    node.addEventListener("click", (event) => {
      event.preventDefault();
      if (!options.disabled) onClick();
    });
    return node;
  }
  function textfield(value, options = {}) {
    const node = el("vscode-textfield", { placeholder: options.placeholder, type: options.type ?? "text" });
    node.value = value;
    if (options.onInput) {
      node.addEventListener("input", (event) => options.onInput(event.target.value));
    }
    return node;
  }
  function checkbox(label, checked, onChange) {
    const node = el("vscode-checkbox", { checked: checked ? true : void 0 });
    node.textContent = label;
    node.addEventListener("change", (event) => {
      const target = event.target;
      onChange(!!target.checked);
    });
    return node;
  }
  function switchRow(title, description, checked, onChange, key) {
    const row = el("div", { class: "switch-row" });
    row.appendChild(checkbox("", checked, onChange));
    const text = el("div", { class: "switch-text" });
    const titleEl = el("div", { class: "switch-title" }, title);
    if (key) titleEl.appendChild(el("span", { class: "mono" }, key));
    text.appendChild(titleEl);
    if (description) text.appendChild(el("div", { class: "field-desc" }, description));
    row.appendChild(text);
    return row;
  }
  function select(options, value, onChange) {
    const node = el("vscode-single-select");
    for (const option of options) {
      const optionEl = el("vscode-option", { value: option.value, description: option.description }, option.label);
      if (option.value === value) optionEl.setAttribute("selected", "");
      node.appendChild(optionEl);
    }
    node.addEventListener("change", (event) => {
      onChange(event.target.value);
    });
    return node;
  }
  function footer(...children) {
    const node = el("div", { class: "footer" });
    append(node, children);
    return node;
  }
  function diffBlock(patch) {
    const node = el("pre", { class: "diff" });
    node.innerHTML = patch.split("\n").map((line) => {
      if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@") || line.startsWith("Index:")) {
        return `<span class="meta">${escapeHtml(line)}</span>`;
      }
      if (line.startsWith("+")) return `<span class="add">${escapeHtml(line)}</span>`;
      if (line.startsWith("-")) return `<span class="del">${escapeHtml(line)}</span>`;
      return `<span class="ctx">${escapeHtml(line)}</span>`;
    }).join("");
    return node;
  }
  var init_dom = __esm({
    "../../src/webviews/client/dom.ts"() {
      "use strict";
    }
  });

  // main.ts
  var require_main = __commonJS({
    "main.ts"() {
      init_bundled();
      init_dom();
      var root = document.getElementById("root");
      root.appendChild(el("h1", {}, "Install dependency"));
      root.appendChild(el("p", { class: "subtitle" }, "Search crates.io, choose a version constraint, then write it into the manifest."));
      var bar = el("div", { class: "toolbar" });
      bar.appendChild(textfield("serde", { placeholder: "Search crates.io\u2026" }));
      bar.appendChild(button("Search", () => {
      }));
      bar.appendChild(button("Cancel", () => {
      }, { secondary: true }));
      root.appendChild(bar);
      root.appendChild(section(
        "Version constraint",
        select([{ value: "^1", label: "^1 (default)" }, { value: "=1.0.229", label: "=1.0.229" }, { value: "*", label: "* (any)" }], "^1", () => {
        })
      ));
      root.appendChild(section(
        "Options",
        switchRow("Optional dependency", "Exposed as a feature of this crate.", true, () => {
        }),
        switchRow("Disable default features", "Disables the crate default feature set.", false, () => {
        })
      ));
      root.appendChild(section(
        "Results",
        el("div", { class: "search-result selected" }, el("span", { class: "name" }, "serde"), el("span", { class: "desc" }, "A generic serialization/deserialization framework"), badge("1.0.229", "accent")),
        el("div", { class: "search-result" }, el("span", { class: "name" }, "serde_json"), el("span", { class: "desc" }, "A JSON serialization file format"), badge("1.0.149", "accent"))
      ));
      root.appendChild(section(
        "Dependencies",
        el(
          "div",
          { class: "card" },
          el("div", { class: "card-title" }, "serde", badge("safe", "safe"), badge("\u26A0 1", "danger")),
          el("div", { class: "card-meta" }, el("span", { class: "mono" }, "^1.0.228"), el("span", {}, "\u2192 1.0.229"), el("span", {}, "features: derive, rc"))
        ),
        banner("warning", el("div", {}, "Cargo.lock is out of date; the upgrade will run cargo update."))
      ));
      root.appendChild(diffBlock('--- Cargo.toml\n+++ Cargo.toml\n@@ -1,4 +1,4 @@\n [package]\n-version = "0.1.0"\n+version = "0.2.0"'));
      root.appendChild(footer(el("span", { class: "hint" }, "Writes Cargo.toml and runs cargo check."), el("div", { class: "spacer" }), button("Install", () => {
      }), button("Cancel", () => {
      }, { secondary: true })));
    }
  });
  require_main();
})();

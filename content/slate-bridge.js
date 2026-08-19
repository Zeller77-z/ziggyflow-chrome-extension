/**
 * ZiggyFlow Main World Slate & React Fiber Bridge
 * Extracted from TobyFlow v1.2.21 main-world injection engine
 * Injected directly into the target website's execution context
 */

(function () {
  "use strict";

  if (window.__ziggyflowSlateBridgeLoaded) return;
  window.__ziggyflowSlateBridgeLoaded = true;

  const _slateSelector = '[data-slate-editor="true"], div[role="textbox"][contenteditable="true"]';

  function findSlateEditor() {
    const el = document.querySelector(_slateSelector);
    if (!el) return null;
    const fiberKey = Object.keys(el).find(k => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
    if (!fiberKey) return null;

    let fiber = el[fiberKey];
    while (fiber) {
      if (fiber.dependencies && fiber.dependencies.firstContext) {
        let ctx = fiber.dependencies.firstContext;
        while (ctx) {
          const ctxVal = ctx.memoizedValue;
          if (ctxVal && typeof ctxVal === "object" && typeof ctxVal.insertText === "function" && Array.isArray(ctxVal.children) && typeof ctxVal.apply === "function") {
            return ctxVal;
          }
          ctx = ctx.next;
        }
      }
      let state = fiber.memoizedState;
      while (state) {
        const val = state.memoizedState;
        if (val && typeof val === "object" && Array.isArray(val.children) && typeof val.apply === "function" && typeof val.onChange === "function") {
          return val;
        }
        if (val && typeof val === "object" && val.current && Array.isArray(val.current.children) && typeof val.current.apply === "function") {
          return val.current;
        }
        state = state.next;
      }
      fiber = fiber.return;
    }
    return null;
  }

  function getEndPoint(editor) {
    const path = [];
    let node = { children: editor.children };
    while (node.children && node.children.length > 0) {
      const idx = node.children.length - 1;
      path.push(idx);
      node = node.children[idx];
    }
    return { path, offset: (node.text || "").length };
  }

  function getAllText(node) {
    if (node.text !== undefined) return node.text;
    if (node.children) return node.children.map(getAllText).join("");
    return "";
  }

  function tryInsertText(editor, slateEl, text) {
    const impls = {
      insertText: function () {
        if (!editor.selection) {
          const endPt = getEndPoint(editor);
          editor.selection = { anchor: endPt, focus: endPt };
        }
        editor.insertText(text);
        if (typeof editor.onChange === "function") editor.onChange();
        return true;
      },
      applyOp: function () {
        const pt = getEndPoint(editor);
        editor.apply({ type: "insert_text", path: pt.path, offset: pt.offset, text });
        if (typeof editor.onChange === "function") editor.onChange();
        return true;
      },
      insertData: function () {
        if (typeof editor.insertData !== "function") return false;
        const pt = getEndPoint(editor);
        editor.selection = { anchor: pt, focus: pt };
        const dt = new DataTransfer();
        dt.setData("text/plain", text);
        editor.insertData(dt);
        if (typeof editor.onChange === "function") editor.onChange();
        return true;
      }
    };

    for (const name of ["insertText", "applyOp", "insertData"]) {
      try {
        if (impls[name]()) return name;
      } catch (e) {
        console.warn("[ZiggyFlow Bridge] Insert tier " + name + " failed:", e);
      }
    }
    return null;
  }

  function trySubmitMethods(submitBtn, slateEl) {
    const impls = {
      reactPropsClick: function () {
        if (!submitBtn) return false;
        const propsKey = Object.keys(submitBtn).find(k => k.startsWith("__reactProps$"));
        if (!propsKey) return false;
        const props = submitBtn[propsKey];
        if (typeof props.onClick !== "function") return false;

        const rect = submitBtn.getBoundingClientRect();
        const fakeEvent = {
          preventDefault: () => {},
          stopPropagation: () => {},
          persist: () => {},
          nativeEvent: { isTrusted: true },
          isTrusted: true,
          target: submitBtn,
          currentTarget: submitBtn,
          bubbles: true,
          cancelable: true,
          defaultPrevented: false,
          eventPhase: 3,
          timeStamp: Date.now(),
          type: "click",
          button: 0,
          buttons: 1,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2
        };
        props.onClick(fakeEvent);
        console.log("[ZiggyFlow Bridge] reactPropsClick: onClick executed successfully ✓");
        return true;
      },
      fiberOnSubmit: function () {
        if (!submitBtn) return false;
        const fiberKey = Object.keys(submitBtn).find(k => k.startsWith("__reactFiber$"));
        if (!fiberKey) return false;
        let fiber = submitBtn[fiberKey];
        let depth = 0;
        while (fiber && depth < 50) {
          if (fiber.pendingProps && typeof fiber.pendingProps.onSubmit === "function") {
            fiber.pendingProps.onSubmit({ preventDefault: () => {}, stopPropagation: () => {} });
            console.log("[ZiggyFlow Bridge] fiberOnSubmit: pendingProps.onSubmit executed ✓");
            return true;
          }
          if (fiber.stateNode && typeof fiber.stateNode.handleSubmit === "function") {
            fiber.stateNode.handleSubmit();
            console.log("[ZiggyFlow Bridge] fiberOnSubmit: stateNode.handleSubmit executed ✓");
            return true;
          }
          fiber = fiber.return;
          depth++;
        }
        return false;
      },
      editorContextHooks: function () {
        if (!slateEl) return false;
        const editorFiberKey = Object.keys(slateEl).find(k => k.startsWith("__reactFiber$"));
        if (!editorFiberKey) return false;
        let editorFiber = slateEl[editorFiberKey];
        let edDepth = 0;
        while (editorFiber && edDepth < 50) {
          if (editorFiber.dependencies && editorFiber.dependencies.firstContext) {
            let ctx = editorFiber.dependencies.firstContext;
            while (ctx) {
              const ctxVal = ctx.memoizedValue;
              if (ctxVal && typeof ctxVal === "object") {
                const fn = ctxVal.submit || ctxVal.handleSubmit || ctxVal.onSubmit || ctxVal.sendMessage || ctxVal.generate;
                if (typeof fn === "function") {
                  try {
                    fn();
                    console.log("[ZiggyFlow Bridge] editorContextHooks: context submit fn executed ✓");
                    return true;
                  } catch (e) {}
                }
              }
              ctx = ctx.next;
            }
          }
          if (editorFiber.memoizedState) {
            let hook = editorFiber.memoizedState;
            let hookIdx = 0;
            while (hook && hookIdx < 30) {
              const hookVal = hook.memoizedState;
              if (hookVal && typeof hookVal === "object" && !Array.isArray(hookVal)) {
                const hookFn = hookVal.submit || hookVal.handleSubmit || hookVal.onSubmit || hookVal.sendMessage || hookVal.generate;
                if (typeof hookFn === "function") {
                  try {
                    hookFn();
                    console.log("[ZiggyFlow Bridge] editorContextHooks: hook submit fn executed ✓");
                    return true;
                  } catch (e) {}
                }
              }
              hook = hook.next;
              hookIdx++;
            }
          }
          editorFiber = editorFiber.return;
          edDepth++;
        }
        return false;
      }
    };

    for (const name of ["reactPropsClick", "fiberOnSubmit", "editorContextHooks"]) {
      try {
        if (impls[name]()) return name;
      } catch (e) {
        console.warn("[ZiggyFlow Bridge] Submit method " + name + " failed:", e);
      }
    }
    return null;
  }

  function simulateClick(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 };
    el.dispatchEvent(new PointerEvent("pointerdown", opts));
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    el.dispatchEvent(new PointerEvent("pointerup", opts));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.dispatchEvent(new MouseEvent("click", opts));
  }

  function handleBridgeMessage(e) {
    if (e.source !== window || !e.data || e.data.source !== "ziggyflow-bridge-request") return;

    const action = e.data.action;
    const rid = e.data.requestId;

    if (action === "insertAndSubmit" || action === "insert") {
      const slateEl = document.querySelector(_slateSelector) || document.querySelector('[data-ziggy-prompt="true"]');
      const text = e.data.text || "";

      let editor = findSlateEditor();
      let insertTier = null;

      if (editor && slateEl) {
        slateEl.focus();
        insertTier = tryInsertText(editor, slateEl, text);
      }

      if (action === "insert") {
        window.postMessage({ source: "ziggyflow-bridge-response", requestId: rid, success: true, tier: insertTier }, window.location.origin);
        return;
      }

      // If action is insertAndSubmit, proceed to submission:
      setTimeout(() => {
        let submitBtn = document.querySelector('[data-ziggy-generate="true"]');
        if (!submitBtn) {
          const buttons = Array.from(document.querySelectorAll("button"));
          submitBtn = buttons.find(b => {
            const icon = b.querySelector("i.google-symbols, i[class*='symbol']");
            const iconTxt = icon ? (icon.textContent || "").trim() : "";
            const aria = (b.getAttribute("aria-label") || "").toLowerCase();
            return iconTxt === "arrow_forward" || iconTxt === "send" || aria.includes("generate") || aria.includes("submit") || aria.includes("send");
          });
        }

        let submitMethod = null;
        if (submitBtn) {
          submitMethod = trySubmitMethods(submitBtn, slateEl);
        }

        if (!submitMethod && slateEl) {
          slateEl.focus();
          slateEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true }));
          slateEl.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true }));
          slateEl.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true }));
          submitMethod = "enter_keystroke";
        }

        if (submitBtn) {
          submitBtn.focus();
          simulateClick(submitBtn);
        }

        window.postMessage({
          source: "ziggyflow-bridge-response",
          requestId: rid,
          success: true,
          insertTier: insertTier,
          submitMethod: submitMethod || "pointer_click"
        }, window.location.origin);
      }, 120);
    } else if (action === "submitOnly") {
      let submitBtn = document.querySelector('[data-ziggy-generate="true"]');
      const slateEl = document.querySelector(_slateSelector) || document.querySelector('[data-ziggy-prompt="true"]');
      if (!submitBtn) {
        const buttons = Array.from(document.querySelectorAll("button"));
        submitBtn = buttons.find(b => {
          const icon = b.querySelector("i.google-symbols, i[class*='symbol']");
          const iconTxt = icon ? (icon.textContent || "").trim() : "";
          const aria = (b.getAttribute("aria-label") || "").toLowerCase();
          return iconTxt === "arrow_forward" || iconTxt === "send" || aria.includes("generate") || aria.includes("submit") || aria.includes("send");
        });
      }

      let submitMethod = null;
      if (submitBtn) {
        submitMethod = trySubmitMethods(submitBtn, slateEl);
        submitBtn.focus();
        simulateClick(submitBtn);
      }

      if (slateEl) {
        slateEl.focus();
        slateEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true }));
      }

      window.postMessage({
        source: "ziggyflow-bridge-response",
        requestId: rid,
        success: true,
        submitMethod: submitMethod || "enter_and_click"
      }, window.location.origin);
    }
  }

  window.addEventListener("message", handleBridgeMessage);
  console.log("ZiggyFlow: Slate & React Main-World Bridge injected and active.");
})();

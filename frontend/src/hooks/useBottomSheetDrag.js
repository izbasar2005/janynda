import { useCallback, useLayoutEffect, useRef, useState } from "react";

const SPRING_CLOSE_MS = 340;
const CLOSE_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
const OPEN_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
const DRAG_START_PX = 2;

/**
 * Интерактивті bottom sheet: төменнен ашу + төмен қарай тартып жабу.
 * Web Pointer Events (React Native PanResponder аналогы).
 */
export function useBottomSheetDrag({ open, onClose }) {
    const panelRef = useRef(null);
    const bodyRef = useRef(null);
    const dragRef = useRef({
        active: false,
        pointerId: null,
        startY: 0,
        offset: 0,
        moved: false,
        fromHandle: false,
        lastY: 0,
        lastTime: 0,
        velocityY: 0,
    });
    const blockClickRef = useRef(false);

    const [translatePx, setTranslatePx] = useState(null);
    const [animating, setAnimating] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [backdropOpacity, setBackdropOpacity] = useState(0);

    const getPanelHeight = useCallback(() => {
        const el = panelRef.current;
        return el ? el.offsetHeight : window.innerHeight * 0.6;
    }, []);

    const applyTransform = useCallback((px, transition) => {
        const el = panelRef.current;
        if (!el) return;
        if (transition) el.style.transition = transition;
        else el.style.transition = "none";
        el.style.transform = `translateY(${px}px)`;
    }, []);

    const resetClosed = useCallback(() => {
        const h = getPanelHeight();
        setTranslatePx(h);
        setBackdropOpacity(0);
        applyTransform(h, "none");
    }, [applyTransform, getPanelHeight]);

    const syncBackdrop = useCallback((offset) => {
        const h = getPanelHeight();
        const progress = Math.min(1, Math.max(0, offset / h));
        setBackdropOpacity(1 - progress * 0.85);
    }, [getPanelHeight]);

    useLayoutEffect(() => {
        if (!open) {
            setDragging(false);
            setAnimating(false);
            resetClosed();
            return;
        }

        setAnimating(true);
        const h = getPanelHeight();
        applyTransform(h, "none");
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setTranslatePx(0);
                setBackdropOpacity(1);
                applyTransform(0, `transform ${OPEN_EASING} 0.38s`);
                window.setTimeout(() => setAnimating(false), 400);
            });
        });
    }, [open, applyTransform, getPanelHeight, resetClosed]);

    const finishClose = useCallback(() => {
        setAnimating(true);
        const h = getPanelHeight();
        setTranslatePx(h);
        setBackdropOpacity(0);
        applyTransform(h, `transform ${CLOSE_EASING} ${SPRING_CLOSE_MS}ms`);
        window.setTimeout(() => {
            setAnimating(false);
            onClose();
        }, SPRING_CLOSE_MS);
    }, [applyTransform, getPanelHeight, onClose]);

    const snapBack = useCallback(() => {
        setAnimating(true);
        setTranslatePx(0);
        setBackdropOpacity(1);
        applyTransform(0, `transform ${CLOSE_EASING} ${SPRING_CLOSE_MS}ms`);
        window.setTimeout(() => setAnimating(false), SPRING_CLOSE_MS);
    }, [applyTransform]);

    const onPointerDown = useCallback((e) => {
        if (!open) return;
        const target = e.target;
        const onHandle = target.closest?.("[data-sheet-handle]");
        const onPanel = panelRef.current?.contains(target);
        if (!onPanel) return;

        // Мәзір батырмаларына қалыпты клик өтсін (pointer capture қойылмайды)
        if (target.closest?.("button, a") && !onHandle) return;

        const body = bodyRef.current;
        const fromBody = body?.contains(target) && !onHandle;
        if (fromBody && body && body.scrollTop > 0) return;

        const now = Date.now();
        blockClickRef.current = false;
        dragRef.current = {
            active: true,
            pointerId: e.pointerId,
            startY: e.clientY,
            offset: 0,
            moved: false,
            fromHandle: Boolean(onHandle),
            lastY: e.clientY,
            lastTime: now,
            velocityY: 0,
        };
        setDragging(true);
        panelRef.current?.setPointerCapture(e.pointerId);
    }, [open]);

    const onPointerMove = useCallback((e) => {
        const d = dragRef.current;
        if (!d.active || e.pointerId !== d.pointerId) return;

        const now = Date.now();
        const dt = Math.max(now - d.lastTime, 1);
        d.velocityY = (e.clientY - d.lastY) / dt;
        d.lastY = e.clientY;
        d.lastTime = now;

        const dy = e.clientY - d.startY;
        const startThreshold = d.fromHandle ? DRAG_START_PX : 4;

        if (!d.moved && Math.abs(dy) < startThreshold) return;

        d.moved = true;
        const offset = dy <= 0 ? 0 : dy;
        d.offset = offset;
        setTranslatePx(offset);
        syncBackdrop(offset);
        applyTransform(offset, "none");
    }, [applyTransform, syncBackdrop]);

    const onPointerUp = useCallback((e) => {
        const d = dragRef.current;
        if (!d.active || e.pointerId !== d.pointerId) return;

        d.active = false;
        setDragging(false);
        panelRef.current?.releasePointerCapture(e.pointerId);

        if (!d.moved) {
            blockClickRef.current = false;
            return;
        }

        blockClickRef.current = true;

        const h = getPanelHeight();
        const threshold = Math.max(48, h * 0.14);
        const shouldClose =
            d.offset >= threshold ||
            d.offset >= h * 0.38 ||
            d.velocityY > 0.45;

        if (shouldClose) {
            finishClose();
        } else {
            snapBack();
        }
        d.offset = 0;
    }, [finishClose, getPanelHeight, snapBack]);

    const onPointerCancel = useCallback((e) => {
        if (!dragRef.current.active) return;
        dragRef.current.active = false;
        setDragging(false);
        snapBack();
    }, [snapBack]);

    return {
        panelRef,
        bodyRef,
        dragging,
        animating,
        translatePx,
        sheetProps: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel,
        },
        closeSheet: finishClose,
        shouldBlockClick: () => blockClickRef.current,
        backdropOpacity,
    };
}

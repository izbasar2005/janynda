import { useCallback, useLayoutEffect, useRef, useState } from "react";

const SPRING_CLOSE_MS = 380;
const CLOSE_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
const OPEN_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

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
    });
    const blockClickRef = useRef(false);

    const [translatePx, setTranslatePx] = useState(null);
    const [animating, setAnimating] = useState(false);
    const [dragging, setDragging] = useState(false);

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
        applyTransform(h, "none");
    }, [applyTransform, getPanelHeight]);

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
                applyTransform(0, `transform ${OPEN_EASING} 0.38s`);
                window.setTimeout(() => setAnimating(false), 400);
            });
        });
    }, [open, applyTransform, getPanelHeight, resetClosed]);

    const finishClose = useCallback(() => {
        setAnimating(true);
        const h = getPanelHeight();
        setTranslatePx(h);
        applyTransform(h, `transform ${CLOSE_EASING} ${SPRING_CLOSE_MS}ms`);
        window.setTimeout(() => {
            setAnimating(false);
            onClose();
        }, SPRING_CLOSE_MS);
    }, [applyTransform, getPanelHeight, onClose]);

    const snapBack = useCallback(() => {
        setAnimating(true);
        setTranslatePx(0);
        applyTransform(0, `transform ${CLOSE_EASING} ${SPRING_CLOSE_MS}ms`);
        window.setTimeout(() => setAnimating(false), SPRING_CLOSE_MS);
    }, [applyTransform]);

    const onPointerDown = useCallback((e) => {
        if (!open || animating) return;
        const target = e.target;
        const onHandle = target.closest?.("[data-sheet-handle]");
        const onPanel = panelRef.current?.contains(target);
        if (!onPanel) return;

        // Мәзір батырмаларына қалыпты клик өтсін (pointer capture қойылмайды)
        if (target.closest?.("button, a") && !onHandle) return;

        const body = bodyRef.current;
        const fromBody = body?.contains(target) && !onHandle;
        if (fromBody && body && body.scrollTop > 0) return;

        blockClickRef.current = false;
        dragRef.current = {
            active: true,
            pointerId: e.pointerId,
            startY: e.clientY,
            offset: 0,
            moved: false,
        };
        setDragging(true);
        panelRef.current?.setPointerCapture(e.pointerId);
    }, [open, animating]);

    const onPointerMove = useCallback((e) => {
        const d = dragRef.current;
        if (!d.active || e.pointerId !== d.pointerId) return;

        const dy = e.clientY - d.startY;
        if (!d.moved && Math.abs(dy) < 10) return;

        d.moved = true;
        const rubber = dy < 0 ? dy * 0.18 : dy;
        const offset = Math.max(0, rubber);
        d.offset = offset;
        setTranslatePx(offset);
        applyTransform(offset, "none");
    }, [applyTransform]);

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
        const threshold = Math.min(110, h * 0.22);
        if (d.offset > threshold) {
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
    };
}

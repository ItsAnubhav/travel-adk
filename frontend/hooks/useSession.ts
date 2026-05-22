import { useState } from 'react';

export interface SessionParams {
    sid: string;
    bRef: string;
    cId: string;
    isNewSession: boolean;
}

export const useSession = () => {
    const [params] = useState<SessionParams>(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const hasSessionId = searchParams.has('session_id');
        const sid = searchParams.get('session_id') || `sess_${Math.random().toString(36).slice(2, 10)}`;
        const bRef = searchParams.get('booking_ref') || 'N/A';
        const cId = searchParams.get('company_id') || 'N/A';

        // Auto-update URL if session_id was missing
        if (!hasSessionId) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('session_id', sid);
            window.history.replaceState({}, '', newUrl.toString());
        }

        return { sid, bRef, cId, isNewSession: !hasSessionId };
    });

    return params;
};

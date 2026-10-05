"use client";

import { useEffect } from 'react';
import { DeepLinkHandler } from './DeepLinkHandler';

export default function DeepLinkInit() {
    useEffect(() => {
        DeepLinkHandler.init();
    }, []);
    return null;
}

import React from 'react';
import { Download, Check, AlertCircle } from 'lucide-react';
import Spinner from '@/reusable/animations/loading/Spinner';

interface DownloadButtonProps {
    status: 'idle' | 'downloading' | 'downloaded' | 'error';
    progress?: number; // 0-100
    onClick: (e: React.MouseEvent) => void;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    label?: string; // Optional text label (e.g. "Download All")
}

export default function DownloadButton({ 
    status, 
    progress = 0, 
    onClick, 
    size = 'md',
    className = '',
    label
}: DownloadButtonProps) {
    
    const iconSizes = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6'
    };

    const getIcon = () => {
        switch (status) {
            case 'downloading':
                return <Spinner size="sm" color="border-purple-500" />;
            case 'downloaded':
                return <Check className={`${iconSizes[size]} text-green-500`} />;
            case 'error':
                return <AlertCircle className={`${iconSizes[size]} text-red-500`} />;
            default:
                return <Download className={`${iconSizes[size]} text-white`} />;
        }
    };

    const getBgColor = () => {
        switch (status) {
            case 'downloaded': return 'bg-green-500/10 hover:bg-green-500/20';
            case 'error': return 'bg-red-500/10 hover:bg-red-500/20';
            default: return 'bg-white/10 hover:bg-white/20';
        }
    };

    return (
        <button
            onClick={onClick}
            disabled={status === 'downloading' || status === 'downloaded'}
            className={`
                relative overflow-hidden rounded-full flex items-center justify-center gap-2 transition-all
                ${getBgColor()} 
                ${size === 'sm' ? 'p-1.5' : size === 'lg' ? 'p-3 px-6' : 'p-2 px-4'}
                ${className}
            `}
        >
            {/* Progress Bar Background */}
            {status === 'downloading' && progress > 0 && (
                <div 
                    className="absolute inset-0 bg-purple-500/20 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            )}

            <div className="relative z-10 flex items-center gap-2">
                {getIcon()}
                {label && <span className="font-semibold text-sm">{label}</span>}
            </div>
        </button>
    );
}

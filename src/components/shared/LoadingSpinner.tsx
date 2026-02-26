import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    text?: string;
}

export function LoadingSpinner({ size = 'md', text }: LoadingSpinnerProps) {
    const sizeClass = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12',
    }[size];

    return (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className={`${sizeClass} animate-spin text-primary`} />
            {text && <p className="text-sm text-muted-foreground">{text}</p>}
        </div>
    );
}

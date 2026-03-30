import React from 'react';

/**
 * Yakalanmayan render hatalarında boş beyaz ekran yerine mesaj gösterir.
 */
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('ErrorBoundary:', error, info?.componentStack);
    }

    render() {
        if (this.state.error) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background text-foreground">
                    <h1 className="text-lg font-semibold">Bir hata oluştu</h1>
                    <p className="text-sm text-muted-foreground max-w-lg text-center">
                        {this.state.error?.message || String(this.state.error)}
                    </p>
                    <button
                        type="button"
                        className="rounded-md px-4 py-2 bg-primary text-primary-foreground text-sm"
                        onClick={() => window.location.reload()}
                    >
                        Sayfayı yenile
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

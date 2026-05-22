import React from 'react';
import { CreditCard as CardIcon, ShieldCheck } from 'lucide-react';
import { CreditCard } from '../types';

interface CreditCardProps {
    card: CreditCard;
}

const CreditCardComponent: React.FC<CreditCardProps> = ({ card }) => {
    // Determine gradient based on card type or provided gradient
    const getGradient = () => {
        if (card.gradient) return card.gradient;
        switch (card.type) {
            case 'visa': return 'linear-gradient(135deg, #1a1f71, #0055b3)';
            case 'mastercard': return 'linear-gradient(135deg, #eb001b, #f79e1b)';
            case 'amex': return 'linear-gradient(135deg, #2f97d3, #006fcf)';
            default: return 'linear-gradient(135deg, #374151, #111827)';
        }
    };

    return (
        <div
            className="relative w-full max-w-[320px] h-[200px] rounded-2xl shadow-xl overflow-hidden my-4 transition-transform hover:scale-[1.02] duration-300"
            style={{ background: getGradient() }}
        >
            {/* Background Patterns */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full blur-xl translate-y-1/2 -translate-x-1/2"></div>

            <div className="relative z-10 p-6 flex flex-col justify-between h-full text-white">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="bg-white/20 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <ShieldCheck size={10} />
                        Secure
                    </div>
                    <div className="font-bold italic text-xl opacity-90 capitalize">
                        {card.type}
                    </div>
                </div>

                {/* Chip */}
                <div className="flex items-center gap-4 my-2">
                    <div className="w-10 h-8 bg-yellow-400/80 rounded-md border border-yellow-300/50 flex">
                        <div className="flex-1 border-r border-yellow-600/20"></div>
                        <div className="flex-1 border-r border-yellow-600/20"></div>
                    </div>
                    <CardIcon size={24} className="opacity-50" />
                </div>

                {/* Number */}
                <div className="font-mono text-xl sm:text-2xl tracking-widest text-shadow-sm flex gap-4">
                    <span>••••</span>
                    <span>••••</span>
                    <span>••••</span>
                    <span>{card.last4}</span>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-end">
                    <div>
                        <div className="text-[8px] uppercase tracking-widest opacity-70 mb-0.5">Card Holder</div>
                        <div className="font-medium tracking-wide text-sm">{card.cardHolder.toUpperCase()}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[8px] uppercase tracking-widest opacity-70 mb-0.5">Expires</div>
                        <div className="font-mono font-bold text-sm">{card.expiry}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreditCardComponent;

// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import './pro-analysis.scss';

const MARKETS = [
    { symbol: 'R_10', name: 'Volatility 10 Index', category: 'Volatility' },
    { symbol: 'R_25', name: 'Volatility 25 Index', category: 'Volatility' },
    { symbol: 'R_50', name: 'Volatility 50 Index', category: 'Volatility' },
    { symbol: 'R_75', name: 'Volatility 75 Index', category: 'Volatility' },
    { symbol: 'R_100', name: 'Volatility 100 Index', category: 'Volatility' },
    { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index', category: 'Volatility 1s' },
    { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index', category: 'Volatility 1s' },
    { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index', category: 'Volatility 1s' },
    { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index', category: 'Volatility 1s' },
    { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index', category: 'Volatility 1s' },
    { symbol: 'BOOM300N', name: 'Boom 300 Index', category: 'Boom/Crash' },
    { symbol: 'BOOM500', name: 'Boom 500 Index', category: 'Boom/Crash' },
    { symbol: 'BOOM1000', name: 'Boom 1000 Index', category: 'Boom/Crash' },
    { symbol: 'CRASH300N', name: 'Crash 300 Index', category: 'Boom/Crash' },
    { symbol: 'CRASH500', name: 'Crash 500 Index', category: 'Boom/Crash' },
    { symbol: 'CRASH1000', name: 'Crash 1000 Index', category: 'Boom/Crash' },
    { symbol: 'stpRNG', name: 'Step Index', category: 'Step' },
    { symbol: 'JD10', name: 'Jump 10 Index', category: 'Jump' },
    { symbol: 'JD25', name: 'Jump 25 Index', category: 'Jump' },
    { symbol: 'JD50', name: 'Jump 50 Index', category: 'Jump' },
    { symbol: 'JD75', name: 'Jump 75 Index', category: 'Jump' },
    { symbol: 'JD100', name: 'Jump 100 Index', category: 'Jump' },
];

const DIGIT_LABELS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function getDigitFromTick(tick: number): number {
    const str = tick.toString();
    const last = str.replace('.', '').slice(-1);
    return parseInt(last, 10);
}

function computeSignal(digits: number[]): { signal: string; strength: number; even: number; odd: number; last: number } {
    if (digits.length < 10) return { signal: 'Analyzing...', strength: 0, even: 0, odd: 0, last: -1 };
    const recent = digits.slice(-30);
    const counts = Array(10).fill(0);
    recent.forEach(d => counts[d]++);
    const even = [0, 2, 4, 6, 8].reduce((s, i) => s + counts[i], 0);
    const odd = [1, 3, 5, 7, 9].reduce((s, i) => s + counts[i], 0);
    const last = digits[digits.length - 1];
    const evenPct = (even / recent.length) * 100;
    const strength = Math.abs(evenPct - 50);
    const signal = evenPct > 55 ? 'EVEN' : evenPct < 45 ? 'ODD' : 'NEUTRAL';
    return { signal, strength: Math.round(strength), even, odd, last };
}

const WS_URL = 'wss://ws.derivws.com/websockets/v3?app_id=1089';

const ProAnalysis = observer(({ handleTabChange }: { handleTabChange: (tab: number) => void }) => {
    const { dashboard } = useStore();
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
    const [marketData, setMarketData] = useState<Record<string, { digits: number[]; price: number; change: number }>>({});
    const [aiState, setAiState] = useState<'idle' | 'scanning' | 'found'>('idle');
    const [bestMarket, setBestMarket] = useState<typeof MARKETS[0] | null>(null);
    const [stake, setStake] = useState<string>('1');
    const [martingale, setMartingale] = useState<string>('2.2');
    const [aiMarketType, setAiMarketType] = useState<string>('All');
    const wsRef = useRef<WebSocket | null>(null);
    const subsRef = useRef<Set<string>>(new Set());
    const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const categories = ['All', ...Array.from(new Set(MARKETS.map(m => m.category)))];

    const filteredMarkets = selectedCategory === 'All'
        ? MARKETS
        : MARKETS.filter(m => m.category === selectedCategory);

    const connectWS = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            subsRef.current.forEach(sym => {
                ws.send(JSON.stringify({ ticks: sym, subscribe: 1 }));
            });
        };

        ws.onmessage = (evt) => {
            try {
                const data = JSON.parse(evt.data);
                if (data.msg_type === 'tick' && data.tick) {
                    const { symbol, quote } = data.tick;
                    const digit = getDigitFromTick(quote);
                    setMarketData(prev => {
                        const existing = prev[symbol] || { digits: [], price: 0, change: 0 };
                        const newDigits = [...existing.digits, digit].slice(-50);
                        const change = existing.price ? ((quote - existing.price) / existing.price) * 100 : 0;
                        return { ...prev, [symbol]: { digits: newDigits, price: quote, change } };
                    });
                }
            } catch {}
        };

        ws.onclose = () => {
            reconnectRef.current = setTimeout(connectWS, 3000);
        };
    }, []);

    useEffect(() => {
        connectWS();
        return () => {
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
            wsRef.current?.close();
        };
    }, [connectWS]);

    const subscribeMarket = useCallback((symbol: string) => {
        if (subsRef.current.has(symbol)) return;
        subsRef.current.add(symbol);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
        }
    }, []);

    useEffect(() => {
        filteredMarkets.forEach(m => subscribeMarket(m.symbol));
    }, [filteredMarkets, subscribeMarket]);

    useEffect(() => {
        if (selectedMarket) subscribeMarket(selectedMarket);
    }, [selectedMarket, subscribeMarket]);

    const runAiScan = useCallback(() => {
        setAiState('scanning');
        setBestMarket(null);
        const scanMarkets = aiMarketType === 'All' ? MARKETS : MARKETS.filter(m => m.category === aiMarketType);
        scanMarkets.forEach(m => subscribeMarket(m.symbol));

        setTimeout(() => {
            let best: typeof MARKETS[0] | null = null;
            let bestStrength = -1;
            scanMarkets.forEach(market => {
                const data = marketData[market.symbol];
                if (!data) return;
                const { strength } = computeSignal(data.digits);
                if (strength > bestStrength) {
                    bestStrength = strength;
                    best = market;
                }
            });
            if (!best && scanMarkets.length > 0) best = scanMarkets[0];
            setBestMarket(best);
            setAiState('found');
        }, 4000);
    }, [aiMarketType, marketData, subscribeMarket]);

    const handleRunBot = useCallback(() => {
        if (!bestMarket) return;
        dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER);
        if (handleTabChange) handleTabChange(DBOT_TABS.BOT_BUILDER);
    }, [bestMarket, dashboard, handleTabChange]);

    const detail = selectedMarket ? (marketData[selectedMarket] || { digits: [], price: 0, change: 0 }) : null;
    const detailMarket = selectedMarket ? MARKETS.find(m => m.symbol === selectedMarket) : null;
    const detailSignal = detail ? computeSignal(detail.digits) : null;

    return (
        <div className='pro-analysis'>
            <div className='pro-analysis__header'>
                <div className='pro-analysis__title'>
                    <span className='pro-analysis__title-icon'>📊</span>
                    <div>
                        <h1>Pro Analysis</h1>
                        <p>Live market analysis with AI-powered entry recommendations</p>
                    </div>
                </div>

                <div className='pro-analysis__ai-panel'>
                    <div className='pro-analysis__ai-controls'>
                        <div className='pro-analysis__field'>
                            <label>Market Type</label>
                            <select value={aiMarketType} onChange={e => setAiMarketType(e.target.value)}>
                                <option value='All'>All Markets</option>
                                {Array.from(new Set(MARKETS.map(m => m.category))).map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div className='pro-analysis__field'>
                            <label>Stake ($)</label>
                            <input type='number' value={stake} onChange={e => setStake(e.target.value)} min='0.35' step='0.01' />
                        </div>
                        <div className='pro-analysis__field'>
                            <label>Martingale</label>
                            <input type='number' value={martingale} onChange={e => setMartingale(e.target.value)} min='1' step='0.1' />
                        </div>
                        <button
                            className={`pro-analysis__ai-btn ${aiState === 'scanning' ? 'scanning' : ''}`}
                            onClick={runAiScan}
                            disabled={aiState === 'scanning'}
                        >
                            {aiState === 'idle' && <><span>🤖</span> AI Scan Markets</>}
                            {aiState === 'scanning' && <><span className='spinner' /> Scanning Markets...</>}
                            {aiState === 'found' && <><span>🤖</span> Re-scan Markets</>}
                        </button>
                    </div>

                    {aiState === 'found' && bestMarket && (
                        <div className='pro-analysis__ai-result'>
                            <div className='pro-analysis__ai-result-badge'>
                                <span>✅ Best Market Found</span>
                            </div>
                            <div className='pro-analysis__ai-result-info'>
                                <strong>{bestMarket.name}</strong>
                                <span className='pro-analysis__ai-result-meta'>
                                    {(() => {
                                        const d = marketData[bestMarket.symbol];
                                        const sig = d ? computeSignal(d.digits) : null;
                                        return sig ? `Signal: ${sig.signal} | Strength: ${sig.strength}%` : 'Analyzing...';
                                    })()}
                                </span>
                                <span>Stake: ${stake} | Martingale: {martingale}x</span>
                            </div>
                            <button className='pro-analysis__run-btn' onClick={handleRunBot}>
                                🚀 Run Bot in Builder
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className='pro-analysis__body'>
                <div className='pro-analysis__markets'>
                    <div className='pro-analysis__category-tabs'>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                className={`pro-analysis__cat-tab ${selectedCategory === cat ? 'active' : ''}`}
                                onClick={() => setSelectedCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className='pro-analysis__market-grid'>
                        {filteredMarkets.map(market => {
                            const data = marketData[market.symbol] || { digits: [], price: 0, change: 0 };
                            const { signal, strength, last } = computeSignal(data.digits);
                            const isSelected = selectedMarket === market.symbol;
                            const isBest = bestMarket?.symbol === market.symbol;

                            return (
                                <div
                                    key={market.symbol}
                                    className={`pro-analysis__market-card ${isSelected ? 'selected' : ''} ${isBest ? 'best' : ''}`}
                                    onClick={() => setSelectedMarket(market.symbol)}
                                >
                                    {isBest && <div className='pro-analysis__best-badge'>🏆 AI Pick</div>}
                                    <div className='pro-analysis__card-header'>
                                        <span className='pro-analysis__market-name'>{market.name}</span>
                                        <span className={`pro-analysis__price ${data.change >= 0 ? 'up' : 'down'}`}>
                                            {data.price ? data.price.toFixed(4) : '—'}
                                        </span>
                                    </div>
                                    <div className='pro-analysis__card-digits'>
                                        {data.digits.slice(-10).map((d, i) => (
                                            <span key={i} className={`pro-analysis__digit pro-analysis__digit--${d % 2 === 0 ? 'even' : 'odd'}`}>
                                                {d}
                                            </span>
                                        ))}
                                        {data.digits.length === 0 && (
                                            <span className='pro-analysis__loading'>Connecting...</span>
                                        )}
                                    </div>
                                    <div className='pro-analysis__card-footer'>
                                        <span className={`pro-analysis__signal pro-analysis__signal--${signal.toLowerCase()}`}>
                                            {signal}
                                        </span>
                                        {strength > 0 && (
                                            <span className='pro-analysis__strength'>{strength}% strength</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {selectedMarket && detailMarket && detail && detailSignal && (
                    <div className='pro-analysis__detail'>
                        <div className='pro-analysis__detail-header'>
                            <h2>{detailMarket.name}</h2>
                            <span className='pro-analysis__detail-price'>
                                {detail.price ? detail.price.toFixed(5) : '—'}
                            </span>
                        </div>

                        <div className='pro-analysis__live-digits'>
                            <h3>Live Digit Stream</h3>
                            <div className='pro-analysis__digit-stream'>
                                {detail.digits.slice(-20).map((d, i) => (
                                    <span
                                        key={i}
                                        className={`pro-analysis__stream-digit ${i === detail.digits.slice(-20).length - 1 ? 'latest' : ''} ${d % 2 === 0 ? 'even' : 'odd'}`}
                                    >
                                        {d}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className='pro-analysis__digit-dist'>
                            <h3>Digit Distribution (last 50 ticks)</h3>
                            <div className='pro-analysis__bars'>
                                {DIGIT_LABELS.map((label, i) => {
                                    const count = detail.digits.slice(-50).filter(d => d === i).length;
                                    const pct = detail.digits.length > 0 ? (count / Math.min(detail.digits.length, 50)) * 100 : 0;
                                    return (
                                        <div key={i} className='pro-analysis__bar-item'>
                                            <div className='pro-analysis__bar-label'>{label}</div>
                                            <div className='pro-analysis__bar-track'>
                                                <div
                                                    className={`pro-analysis__bar-fill ${i % 2 === 0 ? 'even' : 'odd'}`}
                                                    style={{ height: `${pct * 1.5}px` }}
                                                />
                                            </div>
                                            <div className='pro-analysis__bar-pct'>{Math.round(pct)}%</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className='pro-analysis__signal-summary'>
                            <div className={`pro-analysis__signal-box pro-analysis__signal-box--${detailSignal.signal.toLowerCase()}`}>
                                <span className='pro-analysis__signal-label'>Recommended Entry</span>
                                <span className='pro-analysis__signal-value'>{detailSignal.signal}</span>
                                <span className='pro-analysis__signal-meta'>
                                    Even: {detailSignal.even} | Odd: {detailSignal.odd} | Strength: {detailSignal.strength}%
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

export default ProAnalysis;

// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { api_base } from '@/external/bot-skeleton';
import './manual-trader.scss';

const MARKETS = [
    { label: 'Volatility 10',    symbol: 'R_10',     group: 'Volatility' },
    { label: 'Volatility 25',    symbol: 'R_25',     group: 'Volatility' },
    { label: 'Volatility 50',    symbol: 'R_50',     group: 'Volatility' },
    { label: 'Volatility 75',    symbol: 'R_75',     group: 'Volatility' },
    { label: 'Volatility 100',   symbol: 'R_100',    group: 'Volatility' },
    { label: 'Volatility 10 (1s)', symbol: '1HZ10V', group: 'Volatility 1s' },
    { label: 'Volatility 25 (1s)', symbol: '1HZ25V', group: 'Volatility 1s' },
    { label: 'Volatility 50 (1s)', symbol: '1HZ50V', group: 'Volatility 1s' },
    { label: 'Volatility 75 (1s)', symbol: '1HZ75V', group: 'Volatility 1s' },
    { label: 'Volatility 100 (1s)', symbol: '1HZ100V', group: 'Volatility 1s' },
];

const CONTRACT_TYPES = {
    even_odd: [
        { label: 'Even', type: 'DIGITEVEN', desc: 'Last digit is even (0,2,4,6,8)' },
        { label: 'Odd',  type: 'DIGITODD',  desc: 'Last digit is odd (1,3,5,7,9)' },
    ],
    over_under: [
        { label: 'Over',  type: 'DIGITOVER',  desc: 'Last digit is strictly over barrier' },
        { label: 'Under', type: 'DIGITUNDER', desc: 'Last digit is strictly under barrier' },
    ],
    matches_differs: [
        { label: 'Matches', type: 'DIGITMATCH', desc: 'Last digit matches barrier exactly' },
        { label: 'Differs', type: 'DIGITDIFF',  desc: 'Last digit differs from barrier' },
    ],
};

const TRADE_GROUPS = [
    { key: 'even_odd',        label: 'Even / Odd',        needsBarrier: false },
    { key: 'over_under',      label: 'Over / Under',      needsBarrier: true  },
    { key: 'matches_differs', label: 'Matches / Differs', needsBarrier: true  },
];

const APP_ID = '61453';
const WS_URL  = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`;

const ManualTrader = observer(() => {
    const [selectedMarket, setSelectedMarket] = useState(MARKETS[2]);
    const [digits, setDigits]         = useState<number[]>([]);
    const [currentDigit, setCurrentDigit] = useState<number | null>(null);
    const [tradeGroup, setTradeGroup] = useState('even_odd');
    const [selectedType, setSelectedType] = useState(CONTRACT_TYPES.even_odd[0]);
    const [barrier, setBarrier]       = useState<number>(5);
    const [stake, setStake]           = useState('1.00');
    const [status, setStatus]         = useState<'idle' | 'proposing' | 'buying' | 'done' | 'error'>('idle');
    const [lastResult, setLastResult] = useState<any>(null);
    const [proposalId, setProposalId] = useState<string | null>(null);
    const [askPrice, setAskPrice]     = useState<string | null>(null);
    const [errorMsg, setErrorMsg]     = useState<string>('');

    const wsRef  = useRef<WebSocket | null>(null);
    const tickSubRef = useRef<string | null>(null);

    const digitCounts = Array.from({ length: 10 }, (_, d) => ({
        digit: d,
        count: digits.filter(x => x === d).length,
    }));
    const total = digits.length || 1;

    const connectWS = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({ ticks: selectedMarket.symbol, subscribe: 1 }));
        };

        ws.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.msg_type === 'tick' && data.tick) {
                const quote = data.tick.quote.toString();
                const d = parseInt(quote[quote.length - 1], 10);
                setCurrentDigit(d);
                setDigits(prev => [...prev.slice(-499), d]);
                tickSubRef.current = data.tick.id;
            }
        };

        ws.onerror = () => setErrorMsg('WebSocket error — check connection');
    }, [selectedMarket]);

    useEffect(() => {
        setDigits([]);
        setCurrentDigit(null);
        connectWS();
        return () => { wsRef.current?.close(); };
    }, [selectedMarket]);

    const handleGroupChange = (key: string) => {
        setTradeGroup(key);
        setSelectedType(CONTRACT_TYPES[key][0]);
        if (key === 'even_odd') setBarrier(5);
    };

    const handlePropose = async () => {
        if (!api_base.api) { setErrorMsg('Not connected to Deriv API'); return; }
        setStatus('proposing');
        setErrorMsg('');
        setLastResult(null);
        setProposalId(null);
        setAskPrice(null);

        const params: any = {
            proposal: 1,
            amount: parseFloat(stake) || 1,
            basis: 'stake',
            contract_type: selectedType.type,
            currency: 'USD',
            duration: 1,
            duration_unit: 't',
            symbol: selectedMarket.symbol,
        };
        if (TRADE_GROUPS.find(g => g.key === tradeGroup)?.needsBarrier) {
            params.barrier = barrier.toString();
        }

        try {
            const res = await api_base.api.send(params);
            if (res.error) {
                setErrorMsg(res.error.message || 'Proposal error');
                setStatus('error');
                return;
            }
            setProposalId(res.proposal?.id);
            setAskPrice(res.proposal?.ask_price);
            setStatus('buying');
        } catch (err: any) {
            setErrorMsg(err.message || 'Proposal failed');
            setStatus('error');
        }
    };

    const handleBuy = async () => {
        if (!proposalId || !askPrice) return;
        setStatus('buying');
        try {
            const res = await api_base.api.send({ buy: proposalId, price: parseFloat(askPrice) });
            if (res.error) {
                setErrorMsg(res.error.message || 'Buy error');
                setStatus('error');
                return;
            }
            setLastResult(res.buy);
            setStatus('done');
            setTimeout(() => setStatus('idle'), 4000);
        } catch (err: any) {
            setErrorMsg(err.message || 'Buy failed');
            setStatus('error');
        }
    };

    const handleReset = () => {
        setStatus('idle');
        setProposalId(null);
        setAskPrice(null);
        setErrorMsg('');
        setLastResult(null);
    };

    const needsBarrier = TRADE_GROUPS.find(g => g.key === tradeGroup)?.needsBarrier;

    return (
        <div className='manual-trader'>
            {/* Header */}
            <div className='manual-trader__header'>
                <div className='manual-trader__title'>
                    <span className='manual-trader__title-icon'>🖐️</span>
                    <div>
                        <h1>Manual Trader</h1>
                        <p>Live digit feed · Real-time analysis · One-click trade entry</p>
                    </div>
                </div>
                <div className='manual-trader__market-info'>
                    <span className='manual-trader__market-badge'>{selectedMarket.label}</span>
                    <span className='manual-trader__tick-count'>{digits.length} ticks</span>
                </div>
            </div>

            <div className='manual-trader__body'>
                {/* LEFT: Market + Digits */}
                <div className='manual-trader__left'>
                    {/* Market selector */}
                    <div className='manual-trader__section'>
                        <label className='manual-trader__section-label'>Select Market</label>
                        <div className='manual-trader__market-groups'>
                            {['Volatility', 'Volatility 1s'].map(grp => (
                                <div key={grp} className='manual-trader__market-group'>
                                    <span className='manual-trader__market-group-label'>{grp}</span>
                                    <div className='manual-trader__market-buttons'>
                                        {MARKETS.filter(m => m.group === grp).map(m => (
                                            <button
                                                key={m.symbol}
                                                className={`manual-trader__market-btn ${selectedMarket.symbol === m.symbol ? 'active' : ''}`}
                                                onClick={() => setSelectedMarket(m)}
                                            >
                                                {m.symbol === '1HZ10V' ? 'V10(1s)' :
                                                 m.symbol === '1HZ25V' ? 'V25(1s)' :
                                                 m.symbol === '1HZ50V' ? 'V50(1s)' :
                                                 m.symbol === '1HZ75V' ? 'V75(1s)' :
                                                 m.symbol === '1HZ100V' ? 'V100(1s)' :
                                                 m.symbol}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Live digit display */}
                    <div className='manual-trader__section'>
                        <label className='manual-trader__section-label'>Live Digit Stream</label>
                        <div className='manual-trader__digits-grid'>
                            {digitCounts.map(({ digit, count }) => {
                                const pct = Math.round((count / total) * 100);
                                const isCurrent = currentDigit === digit;
                                const isEven = digit % 2 === 0;
                                return (
                                    <div
                                        key={digit}
                                        className={`manual-trader__digit-cell ${isCurrent ? 'current' : ''} ${isEven ? 'even' : 'odd'}`}
                                        onClick={() => needsBarrier && setBarrier(digit)}
                                        style={{ cursor: needsBarrier ? 'pointer' : 'default' }}
                                    >
                                        <div className='manual-trader__digit-num'>{digit}</div>
                                        <div className='manual-trader__digit-bar-wrap'>
                                            <div
                                                className='manual-trader__digit-bar'
                                                style={{ height: `${Math.max(pct, 2)}%` }}
                                            />
                                        </div>
                                        <div className='manual-trader__digit-pct'>{digits.length < 5 ? '—' : `${pct}%`}</div>
                                        {isCurrent && <div className='manual-trader__cursor'>▲</div>}
                                        {needsBarrier && barrier === digit && (
                                            <div className='manual-trader__barrier-tag'>BARRIER</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {needsBarrier && (
                            <p className='manual-trader__barrier-hint'>
                                👆 Click any digit above to set it as your barrier
                            </p>
                        )}
                    </div>

                    {/* Recent ticks ticker */}
                    <div className='manual-trader__section'>
                        <label className='manual-trader__section-label'>Recent Digits</label>
                        <div className='manual-trader__ticker'>
                            {digits.slice(-40).reverse().map((d, i) => (
                                <span
                                    key={i}
                                    className={`manual-trader__ticker-digit ${d % 2 === 0 ? 'even' : 'odd'} ${i === 0 ? 'latest' : ''}`}
                                >
                                    {d}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT: Trade panel */}
                <div className='manual-trader__right'>
                    {/* Trade type group */}
                    <div className='manual-trader__section'>
                        <label className='manual-trader__section-label'>Trade Category</label>
                        <div className='manual-trader__group-tabs'>
                            {TRADE_GROUPS.map(g => (
                                <button
                                    key={g.key}
                                    className={`manual-trader__group-tab ${tradeGroup === g.key ? 'active' : ''}`}
                                    onClick={() => handleGroupChange(g.key)}
                                >
                                    {g.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Contract type buttons */}
                    <div className='manual-trader__section'>
                        <label className='manual-trader__section-label'>Direction</label>
                        <div className='manual-trader__type-buttons'>
                            {CONTRACT_TYPES[tradeGroup].map(ct => (
                                <button
                                    key={ct.type}
                                    className={`manual-trader__type-btn ${selectedType.type === ct.type ? 'active' : ''}`}
                                    onClick={() => setSelectedType(ct)}
                                >
                                    <span className='manual-trader__type-label'>{ct.label}</span>
                                    <span className='manual-trader__type-desc'>{ct.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Barrier selector (Over/Under, Matches/Differs) */}
                    {needsBarrier && (
                        <div className='manual-trader__section'>
                            <label className='manual-trader__section-label'>
                                Barrier Digit <span className='manual-trader__barrier-val'>{barrier}</span>
                            </label>
                            <div className='manual-trader__barrier-digits'>
                                {Array.from({ length: 10 }, (_, d) => (
                                    <button
                                        key={d}
                                        className={`manual-trader__barrier-btn ${barrier === d ? 'active' : ''}`}
                                        onClick={() => setBarrier(d)}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Stake */}
                    <div className='manual-trader__section'>
                        <label className='manual-trader__section-label'>Stake (USD)</label>
                        <div className='manual-trader__stake-row'>
                            {['0.35', '1.00', '2.00', '5.00'].map(s => (
                                <button
                                    key={s}
                                    className={`manual-trader__stake-preset ${stake === s ? 'active' : ''}`}
                                    onClick={() => setStake(s)}
                                >
                                    ${s}
                                </button>
                            ))}
                            <input
                                className='manual-trader__stake-input'
                                type='number'
                                value={stake}
                                min='0.35'
                                step='0.01'
                                onChange={e => setStake(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Trade summary */}
                    <div className='manual-trader__summary-box'>
                        <div className='manual-trader__summary-row'>
                            <span>Market</span><span>{selectedMarket.label}</span>
                        </div>
                        <div className='manual-trader__summary-row'>
                            <span>Contract</span><span>{selectedType.label}</span>
                        </div>
                        {needsBarrier && (
                            <div className='manual-trader__summary-row'>
                                <span>Barrier</span><span>{barrier}</span>
                            </div>
                        )}
                        <div className='manual-trader__summary-row'>
                            <span>Stake</span><span>${stake}</span>
                        </div>
                        <div className='manual-trader__summary-row'>
                            <span>Duration</span><span>1 tick</span>
                        </div>
                    </div>

                    {/* Error */}
                    {errorMsg && (
                        <div className='manual-trader__error'>
                            ⚠️ {errorMsg}
                            <button onClick={handleReset}>✕</button>
                        </div>
                    )}

                    {/* Result */}
                    {status === 'done' && lastResult && (
                        <div className='manual-trader__result'>
                            ✅ Trade placed! Contract #{lastResult.contract_id}
                            <div>Payout: ${lastResult.payout} · Start: ${lastResult.start_time}</div>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className='manual-trader__actions'>
                        {status === 'idle' || status === 'error' ? (
                            <button className='manual-trader__trade-btn' onClick={handlePropose}>
                                📋 Get Price & Trade
                            </button>
                        ) : status === 'proposing' ? (
                            <button className='manual-trader__trade-btn loading' disabled>
                                <span className='manual-trader__spinner' /> Getting price...
                            </button>
                        ) : status === 'buying' && proposalId ? (
                            <div className='manual-trader__confirm-row'>
                                <div className='manual-trader__price-box'>
                                    <span>Ask Price</span>
                                    <strong>${askPrice}</strong>
                                </div>
                                <button className='manual-trader__buy-btn' onClick={handleBuy}>
                                    ✅ Confirm Trade
                                </button>
                                <button className='manual-trader__cancel-btn' onClick={handleReset}>
                                    ✕ Cancel
                                </button>
                            </div>
                        ) : status === 'done' ? (
                            <button className='manual-trader__trade-btn done' onClick={handleReset}>
                                🔄 Place Another Trade
                            </button>
                        ) : null}
                    </div>

                    {/* Statistics */}
                    {digits.length >= 20 && (
                        <div className='manual-trader__stats'>
                            <div className='manual-trader__stat-item'>
                                <span>Even digits</span>
                                <strong style={{ color: '#f73bb2' }}>
                                    {Math.round((digits.filter(d => d % 2 === 0).length / total) * 100)}%
                                </strong>
                            </div>
                            <div className='manual-trader__stat-item'>
                                <span>Odd digits</span>
                                <strong style={{ color: '#8b5cf6' }}>
                                    {Math.round((digits.filter(d => d % 2 !== 0).length / total) * 100)}%
                                </strong>
                            </div>
                            <div className='manual-trader__stat-item'>
                                <span>Over 4</span>
                                <strong style={{ color: '#10b981' }}>
                                    {Math.round((digits.filter(d => d > 4).length / total) * 100)}%
                                </strong>
                            </div>
                            <div className='manual-trader__stat-item'>
                                <span>Under 5</span>
                                <strong style={{ color: '#f59e0b' }}>
                                    {Math.round((digits.filter(d => d < 5).length / total) * 100)}%
                                </strong>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

export default ManualTrader;

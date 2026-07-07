// @ts-nocheck
import React, { useState, useRef, useCallback } from 'react';
import { api_base } from '@/external/bot-skeleton';
import './bulk-trader.scss';

const SYMBOLS = [
    { value: 'R_10',    label: 'Volatility 10  (V10)' },
    { value: 'R_25',    label: 'Volatility 25  (V25)' },
    { value: 'R_50',    label: 'Volatility 50  (V50)' },
    { value: 'R_75',    label: 'Volatility 75  (V75)' },
    { value: 'R_100',   label: 'Volatility 100 (V100)' },
    { value: '1HZ10V',  label: 'Volatility 10  (1s)' },
    { value: '1HZ25V',  label: 'Volatility 25  (1s)' },
    { value: '1HZ50V',  label: 'Volatility 50  (1s)' },
    { value: '1HZ75V',  label: 'Volatility 75  (1s)' },
    { value: '1HZ100V', label: 'Volatility 100 (1s)' },
];

const TRADE_TYPES = [
    { key: 'DIGITOVER',  label: 'Over',    needsBarrier: true  },
    { key: 'DIGITUNDER', label: 'Under',   needsBarrier: true  },
    { key: 'DIGITEVEN',  label: 'Even',    needsBarrier: false },
    { key: 'DIGITODD',   label: 'Odd',     needsBarrier: false },
    { key: 'CALL',       label: 'Rise',    needsBarrier: false },
    { key: 'PUT',        label: 'Fall',    needsBarrier: false },
    { key: 'DIGITMATCH', label: 'Matches', needsBarrier: true  },
    { key: 'DIGITDIFF',  label: 'Differs', needsBarrier: true  },
];

type PositionStatus = 'pending' | 'buying' | 'open' | 'won' | 'lost' | 'error';

interface Position {
    id: number;
    contractId?: number;
    status: PositionStatus;
    buyPrice?: number;
    profit?: number;
    payout?: number;
    errorMsg?: string;
    lastDigit?: number;
}

let _reqId = 10000;
const nextReqId = () => ++_reqId;

function sendRequest(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        if (!api_base.api) { reject(new Error('Not connected to server')); return; }
        const req_id = nextReqId();
        const sub = api_base.api.onMessage().subscribe((msg: any) => {
            if (msg.req_id === req_id) {
                sub.unsubscribe();
                if (msg.error) reject(new Error(msg.error.message || 'API error'));
                else resolve(msg);
            }
        });
        api_base.api.send({ ...data, req_id });
    });
}

function subscribeMessages(handler: (msg: any) => boolean): () => void {
    if (!api_base.api) return () => {};
    const sub = api_base.api.onMessage().subscribe((msg: any) => {
        const done = handler(msg);
        if (done) sub.unsubscribe();
    });
    return () => sub.unsubscribe();
}

const BulkTrader: React.FC = () => {
    const [symbol,    setSymbol]    = useState('R_100');
    const [tradeType, setTradeType] = useState('DIGITEVEN');
    const [barrier,   setBarrier]   = useState('5');
    const [stake,     setStake]     = useState('1');
    const [posCount,  setPosCount]  = useState(5);
    const [isRunning, setIsRunning] = useState(false);
    const [positions, setPositions] = useState<Position[]>([]);
    const [error,     setError]     = useState('');
    const unsubRefs = useRef<Array<() => void>>([]);

    const selectedType = TRADE_TYPES.find(t => t.key === tradeType)!;
    const currency = (api_base as any).account_info?.currency || 'USD';

    const updatePos = useCallback((id: number, patch: Partial<Position>) => {
        setPositions(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    }, []);

    const runSingleTrade = useCallback(async (posId: number) => {
        const stakeVal = parseFloat(stake) || 1;
        try {
            updatePos(posId, { status: 'buying' });

            // Build proposal
            const proposalReq: Record<string, unknown> = {
                proposal: 1,
                amount: stakeVal,
                basis: 'stake',
                contract_type: tradeType,
                currency,
                duration: 1,
                duration_unit: 't',
                symbol,
            };
            if (selectedType.needsBarrier) proposalReq.barrier = barrier;

            const propResp = await sendRequest(proposalReq);
            const proposal = (propResp as any).proposal;
            if (!proposal) throw new Error('No proposal received');

            // Buy
            const buyResp = await sendRequest({ buy: proposal.id, price: proposal.ask_price });
            const bought  = (buyResp as any).buy;
            if (!bought) throw new Error('Purchase failed');

            updatePos(posId, {
                status: 'open',
                contractId: bought.contract_id,
                buyPrice: bought.buy_price,
            });

            // Subscribe to POC for result
            const pocReqId = nextReqId();
            const unsub = subscribeMessages((msg: any) => {
                const poc = msg?.proposal_open_contract;
                if (!poc || poc.contract_id !== bought.contract_id) return false;
                if (poc.status === 'sold' || poc.is_sold) {
                    const profit = typeof poc.profit === 'number' ? poc.profit
                        : (poc.sell_price - poc.buy_price);
                    updatePos(posId, {
                        status: profit >= 0 ? 'won' : 'lost',
                        profit,
                        payout: poc.sell_price,
                        lastDigit: poc.entry_spot_display_value
                            ? parseInt((poc.exit_tick_display_value || '0').slice(-1))
                            : undefined,
                    });
                    return true; // unsubscribe
                }
                return false;
            });
            unsubRefs.current.push(unsub);

            api_base.api.send({
                proposal_open_contract: 1,
                contract_id: bought.contract_id,
                subscribe: 1,
                req_id: pocReqId,
            });

        } catch (err: any) {
            updatePos(posId, { status: 'error', errorMsg: err.message });
        }
    }, [symbol, tradeType, barrier, stake, selectedType, currency, updatePos]);

    const handleRunBulk = useCallback(async () => {
        if (!api_base.api) { setError('Please log in first.'); return; }
        setError('');
        setIsRunning(true);
        unsubRefs.current.forEach(fn => fn());
        unsubRefs.current = [];

        const newPositions: Position[] = Array.from({ length: posCount }, (_, i) => ({
            id: i + 1,
            status: 'pending',
        }));
        setPositions(newPositions);

        // Fire ALL simultaneously
        await Promise.all(newPositions.map(p => runSingleTrade(p.id)));
        setIsRunning(false);
    }, [posCount, runSingleTrade]);

    const stats = {
        won:    positions.filter(p => p.status === 'won').length,
        lost:   positions.filter(p => p.status === 'lost').length,
        open:   positions.filter(p => p.status === 'open' || p.status === 'buying' || p.status === 'pending').length,
        profit: positions.reduce((s, p) => s + (p.profit ?? 0), 0),
    };

    return (
        <div className='bulk-trader'>
            <div className='bulk-trader__header'>
                <div className='bulk-trader__header-icon'>
                    <svg width='36' height='36' viewBox='0 0 40 40' fill='none'>
                        <rect x='4' y='8'  width='32' height='7' rx='2' fill='currentColor' />
                        <rect x='4' y='19' width='32' height='7' rx='2' fill='currentColor' opacity='0.65' />
                        <rect x='4' y='30' width='32' height='7' rx='2' fill='currentColor' opacity='0.35' />
                    </svg>
                </div>
                <div>
                    <h1 className='bulk-trader__title'>Bulk Trader</h1>
                    <p className='bulk-trader__subtitle'>Fire multiple positions simultaneously with one click</p>
                </div>
            </div>

            <div className='bulk-trader__form'>
                {/* Volatility */}
                <div className='bulk-trader__field'>
                    <label className='bulk-trader__label'>Volatility Index</label>
                    <select
                        className='bulk-trader__select'
                        value={symbol}
                        onChange={e => setSymbol(e.target.value)}
                        disabled={isRunning}
                    >
                        {SYMBOLS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                </div>

                {/* Trade Type */}
                <div className='bulk-trader__field'>
                    <label className='bulk-trader__label'>Trade Type</label>
                    <div className='bulk-trader__type-grid'>
                        {TRADE_TYPES.map(t => (
                            <button
                                key={t.key}
                                className={`bulk-trader__type-btn${tradeType === t.key ? ' active' : ''}`}
                                onClick={() => setTradeType(t.key)}
                                disabled={isRunning}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Digit Barrier */}
                {selectedType.needsBarrier && (
                    <div className='bulk-trader__field'>
                        <label className='bulk-trader__label'>
                            Digit Barrier &nbsp;
                            <span className='bulk-trader__label-hint'>
                                ({tradeType === 'DIGITOVER'  ? 'last digit must be >' :
                                  tradeType === 'DIGITUNDER' ? 'last digit must be <' :
                                  tradeType === 'DIGITMATCH' ? 'last digit equals'    :
                                                               'last digit ≠'} {barrier})
                            </span>
                        </label>
                        <div className='bulk-trader__barrier-grid'>
                            {Array.from({ length: 10 }, (_, i) => (
                                <button
                                    key={i}
                                    className={`bulk-trader__barrier-btn${barrier === String(i) ? ' active' : ''}`}
                                    onClick={() => setBarrier(String(i))}
                                    disabled={isRunning}
                                >
                                    {i}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className='bulk-trader__row'>
                    <div className='bulk-trader__field'>
                        <label className='bulk-trader__label'>Stake ({currency})</label>
                        <input
                            className='bulk-trader__input'
                            type='number'
                            min='0.35'
                            step='0.01'
                            value={stake}
                            onChange={e => setStake(e.target.value)}
                            disabled={isRunning}
                        />
                    </div>
                    <div className='bulk-trader__field'>
                        <label className='bulk-trader__label'>Number of Positions</label>
                        <input
                            className='bulk-trader__input'
                            type='number'
                            min='1'
                            max='50'
                            value={posCount}
                            onChange={e => setPosCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                            disabled={isRunning}
                        />
                    </div>
                </div>

                {error && <div className='bulk-trader__error'>⚠️ {error}</div>}

                <button
                    className='bulk-trader__run-btn'
                    onClick={handleRunBulk}
                    disabled={isRunning}
                >
                    {isRunning
                        ? <><span className='bulk-trader__spinner' /> Running {stats.open} positions…</>
                        : `⚡ Run Bulk — ${posCount} position${posCount !== 1 ? 's' : ''}`
                    }
                </button>
            </div>

            {/* Live stats */}
            {positions.length > 0 && (
                <div className='bulk-trader__stats'>
                    <div className='bulk-trader__stat'>
                        <span className='bulk-trader__stat-val'>{positions.length}</span>
                        <span className='bulk-trader__stat-lbl'>Total</span>
                    </div>
                    <div className='bulk-trader__stat bulk-trader__stat--open'>
                        <span className='bulk-trader__stat-val'>{stats.open}</span>
                        <span className='bulk-trader__stat-lbl'>Open</span>
                    </div>
                    <div className='bulk-trader__stat bulk-trader__stat--won'>
                        <span className='bulk-trader__stat-val'>{stats.won}</span>
                        <span className='bulk-trader__stat-lbl'>Won</span>
                    </div>
                    <div className='bulk-trader__stat bulk-trader__stat--lost'>
                        <span className='bulk-trader__stat-val'>{stats.lost}</span>
                        <span className='bulk-trader__stat-lbl'>Lost</span>
                    </div>
                    <div className={`bulk-trader__stat ${stats.profit >= 0 ? 'bulk-trader__stat--profit' : 'bulk-trader__stat--loss'}`}>
                        <span className='bulk-trader__stat-val'>
                            {stats.profit >= 0 ? '+' : ''}{stats.profit.toFixed(2)}
                        </span>
                        <span className='bulk-trader__stat-lbl'>Net P/L</span>
                    </div>
                </div>
            )}

            {/* Position cards */}
            {positions.length > 0 && (
                <div className='bulk-trader__positions'>
                    {positions.map(p => (
                        <div key={p.id} className={`bulk-trader__pos bulk-trader__pos--${p.status}`}>
                            <div className='bulk-trader__pos-num'>#{p.id}</div>
                            <div className='bulk-trader__pos-type'>{selectedType.label}</div>
                            <div className='bulk-trader__pos-status'>
                                {p.status === 'pending' && <><span className='bulk-trader__dot bulk-trader__dot--pending' />Pending</>}
                                {p.status === 'buying'  && <><span className='bulk-trader__dot bulk-trader__dot--buying' />Buying…</>}
                                {p.status === 'open'    && <><span className='bulk-trader__dot bulk-trader__dot--open' />Open</>}
                                {p.status === 'won'     && <>✅ Won</>}
                                {p.status === 'lost'    && <>❌ Lost</>}
                                {p.status === 'error'   && <>⚠️ {p.errorMsg}</>}
                            </div>
                            {(p.status === 'won' || p.status === 'lost') && (
                                <div className={`bulk-trader__pos-profit ${p.profit >= 0 ? 'pos' : 'neg'}`}>
                                    {p.profit >= 0 ? '+' : ''}{(p.profit ?? 0).toFixed(2)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BulkTrader;

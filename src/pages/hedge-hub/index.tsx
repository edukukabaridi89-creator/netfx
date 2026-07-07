// @ts-nocheck
import React, { useState, useRef, useCallback } from 'react';
import { api_base } from '@/external/bot-skeleton';
import './hedge-hub.scss';

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

// Fixed hedge config: OVER 5 + UNDER 4
// OVER 5 wins if last digit > 5  → digits 6,7,8,9 (40%)
// UNDER 4 wins if last digit < 4 → digits 0,1,2,3 (40%)
// Both lose only if digit is 4 or 5 (20% of ticks)
const OVER_BARRIER  = '5';
const UNDER_BARRIER = '4';

type LegStatus = 'pending' | 'buying' | 'open' | 'won' | 'lost' | 'error';

interface HedgeLeg {
    type: 'OVER' | 'UNDER';
    contractType: 'DIGITOVER' | 'DIGITUNDER';
    barrier: string;
    status: LegStatus;
    contractId?: number;
    buyPrice?: number;
    profit?: number;
    errorMsg?: string;
}

interface HedgePair {
    id: number;
    over: HedgeLeg;
    under: HedgeLeg;
    result?: 'profit' | 'loss' | 'both-loss' | 'pending';
}

let _reqId = 20000;
const nextReqId = () => ++_reqId;

function sendRequest(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        if (!api_base.api) { reject(new Error('Not connected')); return; }
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

function trackContract(
    contractId: number,
    onResult: (profit: number, isSold: boolean) => void
): () => void {
    if (!api_base.api) return () => {};
    const sub = api_base.api.onMessage().subscribe((msg: any) => {
        const poc = msg?.proposal_open_contract;
        if (!poc || poc.contract_id !== contractId) return;
        if (poc.status === 'sold' || poc.is_sold) {
            const profit = typeof poc.profit === 'number'
                ? poc.profit
                : (poc.sell_price - poc.buy_price);
            onResult(profit, true);
            sub.unsubscribe();
        }
    });
    api_base.api.send({
        proposal_open_contract: 1,
        contract_id: contractId,
        subscribe: 1,
        req_id: nextReqId(),
    });
    return () => sub.unsubscribe();
}

async function placeLeg(
    contractType: 'DIGITOVER' | 'DIGITUNDER',
    barrier: string,
    stake: number,
    symbol: string,
    currency: string,
    onUpdate: (patch: Partial<HedgeLeg>) => void,
    onResult: (profit: number) => void,
): Promise<() => void> {
    onUpdate({ status: 'buying' });
    try {
        const propResp = await sendRequest({
            proposal: 1,
            amount: stake,
            basis: 'stake',
            contract_type: contractType,
            barrier,
            currency,
            duration: 1,
            duration_unit: 't',
            symbol,
        });
        const proposal = (propResp as any).proposal;
        if (!proposal) throw new Error('No proposal');

        const buyResp = await sendRequest({ buy: proposal.id, price: proposal.ask_price });
        const bought  = (buyResp as any).buy;
        if (!bought) throw new Error('Buy failed');

        onUpdate({ status: 'open', contractId: bought.contract_id, buyPrice: bought.buy_price });
        return trackContract(bought.contract_id, (profit) => {
            onUpdate({ status: profit >= 0 ? 'won' : 'lost', profit });
            onResult(profit);
        });
    } catch (err: any) {
        onUpdate({ status: 'error', errorMsg: err.message });
        return () => {};
    }
}

const HedgeHub: React.FC = () => {
    const [symbol,  setSymbol]  = useState('R_100');
    const [stake,   setStake]   = useState('1');
    const [isFiring, setIsFiring] = useState(false);
    const [pairs,   setPairs]   = useState<HedgePair[]>([]);
    const [error,   setError]   = useState('');
    const pairCounter = useRef(0);
    const unsubRefs   = useRef<Array<() => void>>([]);

    const currency = (api_base as any).account_info?.currency || 'USD';

    const updateLeg = useCallback((pairId: number, side: 'over' | 'under', patch: Partial<HedgeLeg>) => {
        setPairs(prev => prev.map(pair => {
            if (pair.id !== pairId) return pair;
            const updated = { ...pair, [side]: { ...pair[side], ...patch } };

            // Compute pair result when both legs are settled
            const o = updated.over;
            const u = updated.under;
            const settled = (s: LegStatus) => s === 'won' || s === 'lost' || s === 'error';
            if (settled(o.status) && settled(u.status)) {
                const ow = o.status === 'won';
                const uw = u.status === 'won';
                if (ow && !uw) updated.result = 'profit';
                else if (!ow && uw) updated.result = 'profit';
                else updated.result = 'both-loss';
            } else {
                updated.result = 'pending';
            }
            return updated;
        }));
    }, []);

    const fireHedge = useCallback(async () => {
        if (!api_base.api) { setError('Please log in first.'); return; }
        setError('');
        setIsFiring(true);

        const stakeVal = parseFloat(stake) || 1;
        const pairId   = ++pairCounter.current;

        const newPair: HedgePair = {
            id: pairId,
            result: 'pending',
            over:  { type: 'OVER',  contractType: 'DIGITOVER',  barrier: OVER_BARRIER,  status: 'pending' },
            under: { type: 'UNDER', contractType: 'DIGITUNDER', barrier: UNDER_BARRIER, status: 'pending' },
        };

        setPairs(prev => [newPair, ...prev]);

        // Place both legs simultaneously
        const [unsubOver, unsubUnder] = await Promise.all([
            placeLeg(
                'DIGITOVER', OVER_BARRIER, stakeVal, symbol, currency,
                patch => updateLeg(pairId, 'over', patch),
                () => {},
            ),
            placeLeg(
                'DIGITUNDER', UNDER_BARRIER, stakeVal, symbol, currency,
                patch => updateLeg(pairId, 'under', patch),
                () => {},
            ),
        ]);

        unsubRefs.current.push(unsubOver, unsubUnder);
        setIsFiring(false);
    }, [symbol, stake, currency, updateLeg]);

    const stats = {
        total:    pairs.length,
        profit:   pairs.filter(p => p.result === 'profit').length,
        bothLoss: pairs.filter(p => p.result === 'both-loss').length,
        netPL:    pairs.reduce((s, p) => {
            const o = p.over.profit  ?? 0;
            const u = p.under.profit ?? 0;
            return s + o + u;
        }, 0),
    };

    return (
        <div className='hedge-hub'>
            <div className='hedge-hub__header'>
                <div className='hedge-hub__header-icon'>
                    <svg width='36' height='36' viewBox='0 0 40 40' fill='none'>
                        <path d='M8 20 L20 8 L32 20' stroke='currentColor' strokeWidth='3.5' strokeLinecap='round' strokeLinejoin='round' />
                        <path d='M8 20 L20 32 L32 20' stroke='currentColor' strokeWidth='3.5' strokeLinecap='round' strokeLinejoin='round' opacity='0.5' />
                        <circle cx='20' cy='20' r='3.5' fill='currentColor' />
                    </svg>
                </div>
                <div>
                    <h1 className='hedge-hub__title'>Hedge Hub</h1>
                    <p className='hedge-hub__subtitle'>Fire simultaneous Over &amp; Under positions — profit 80% of the time</p>
                </div>
            </div>

            {/* Strategy explanation */}
            <div className='hedge-hub__strategy-card'>
                <div className='hedge-hub__strategy-header'>How the Hedge Works</div>
                <div className='hedge-hub__strategy-legs'>
                    <div className='hedge-hub__strategy-leg hedge-hub__strategy-leg--over'>
                        <span className='hedge-hub__strategy-leg-badge'>OVER 5</span>
                        <span>Wins if last digit is 6, 7, 8, or 9</span>
                    </div>
                    <div className='hedge-hub__strategy-plus'>+</div>
                    <div className='hedge-hub__strategy-leg hedge-hub__strategy-leg--under'>
                        <span className='hedge-hub__strategy-leg-badge'>UNDER 4</span>
                        <span>Wins if last digit is 0, 1, 2, or 3</span>
                    </div>
                </div>
                <div className='hedge-hub__strategy-note'>
                    ✅ One leg wins on <strong>digits 0–3</strong> or <strong>6–9</strong> (80% coverage) &nbsp;·&nbsp;
                    ❌ Both lose only on digits <strong>4</strong> or <strong>5</strong> (20%)
                </div>
            </div>

            {/* Config */}
            <div className='hedge-hub__form'>
                <div className='hedge-hub__field'>
                    <label className='hedge-hub__label'>Volatility Index</label>
                    <select
                        className='hedge-hub__select'
                        value={symbol}
                        onChange={e => setSymbol(e.target.value)}
                        disabled={isFiring}
                    >
                        {SYMBOLS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                </div>

                <div className='hedge-hub__legs-preview'>
                    <div className='hedge-hub__leg-preview hedge-hub__leg-preview--over'>
                        <div className='hedge-hub__leg-preview-label'>Over Barrier</div>
                        <div className='hedge-hub__leg-preview-value'>5</div>
                        <div className='hedge-hub__leg-preview-hint'>digit &gt; 5</div>
                    </div>
                    <div className='hedge-hub__leg-preview hedge-hub__leg-preview--under'>
                        <div className='hedge-hub__leg-preview-label'>Under Barrier</div>
                        <div className='hedge-hub__leg-preview-value'>4</div>
                        <div className='hedge-hub__leg-preview-hint'>digit &lt; 4</div>
                    </div>
                </div>

                <div className='hedge-hub__field'>
                    <label className='hedge-hub__label'>Stake per Side ({currency})</label>
                    <input
                        className='hedge-hub__input'
                        type='number'
                        min='0.35'
                        step='0.01'
                        value={stake}
                        onChange={e => setStake(e.target.value)}
                        disabled={isFiring}
                    />
                    <span className='hedge-hub__input-hint'>
                        Total per hedge: {(parseFloat(stake) * 2 || 0).toFixed(2)} {currency}
                    </span>
                </div>

                {error && <div className='hedge-hub__error'>⚠️ {error}</div>}

                <button
                    className='hedge-hub__fire-btn'
                    onClick={fireHedge}
                    disabled={isFiring}
                >
                    {isFiring
                        ? <><span className='hedge-hub__spinner' />Firing hedge…</>
                        : '🛡️ Fire Hedge'}
                </button>
            </div>

            {/* Session stats */}
            {pairs.length > 0 && (
                <div className='hedge-hub__stats'>
                    <div className='hedge-hub__stat'>
                        <span className='hedge-hub__stat-val'>{stats.total}</span>
                        <span className='hedge-hub__stat-lbl'>Hedges</span>
                    </div>
                    <div className='hedge-hub__stat hedge-hub__stat--profit'>
                        <span className='hedge-hub__stat-val'>{stats.profit}</span>
                        <span className='hedge-hub__stat-lbl'>Profitable</span>
                    </div>
                    <div className='hedge-hub__stat hedge-hub__stat--loss'>
                        <span className='hedge-hub__stat-val'>{stats.bothLoss}</span>
                        <span className='hedge-hub__stat-lbl'>Both Lost</span>
                    </div>
                    <div className={`hedge-hub__stat ${stats.netPL >= 0 ? 'hedge-hub__stat--profit' : 'hedge-hub__stat--loss'}`}>
                        <span className='hedge-hub__stat-val'>
                            {stats.netPL >= 0 ? '+' : ''}{stats.netPL.toFixed(2)}
                        </span>
                        <span className='hedge-hub__stat-lbl'>Net P/L</span>
                    </div>
                </div>
            )}

            {/* Hedge pair cards */}
            {pairs.length > 0 && (
                <div className='hedge-hub__pairs'>
                    {pairs.map(pair => (
                        <div key={pair.id} className={`hedge-hub__pair hedge-hub__pair--${pair.result ?? 'pending'}`}>
                            <div className='hedge-hub__pair-id'>Hedge #{pair.id}</div>

                            <div className='hedge-hub__pair-legs'>
                                {/* OVER leg */}
                                <div className={`hedge-hub__pair-leg hedge-hub__pair-leg--${pair.over.status}`}>
                                    <span className='hedge-hub__pair-leg-type'>OVER {OVER_BARRIER}</span>
                                    <span className='hedge-hub__pair-leg-status'>
                                        {pair.over.status === 'pending' && '⏳'}
                                        {pair.over.status === 'buying'  && '📤'}
                                        {pair.over.status === 'open'    && '🔄'}
                                        {pair.over.status === 'won'     && `✅ +${(pair.over.profit ?? 0).toFixed(2)}`}
                                        {pair.over.status === 'lost'    && `❌ ${(pair.over.profit ?? 0).toFixed(2)}`}
                                        {pair.over.status === 'error'   && `⚠️ ${pair.over.errorMsg}`}
                                    </span>
                                </div>

                                {/* UNDER leg */}
                                <div className={`hedge-hub__pair-leg hedge-hub__pair-leg--${pair.under.status}`}>
                                    <span className='hedge-hub__pair-leg-type'>UNDER {UNDER_BARRIER}</span>
                                    <span className='hedge-hub__pair-leg-status'>
                                        {pair.under.status === 'pending' && '⏳'}
                                        {pair.under.status === 'buying'  && '📤'}
                                        {pair.under.status === 'open'    && '🔄'}
                                        {pair.under.status === 'won'     && `✅ +${(pair.under.profit ?? 0).toFixed(2)}`}
                                        {pair.under.status === 'lost'    && `❌ ${(pair.under.profit ?? 0).toFixed(2)}`}
                                        {pair.under.status === 'error'   && `⚠️ ${pair.under.errorMsg}`}
                                    </span>
                                </div>
                            </div>

                            {/* Pair result badge */}
                            {pair.result && pair.result !== 'pending' && (
                                <div className={`hedge-hub__pair-result hedge-hub__pair-result--${pair.result}`}>
                                    {pair.result === 'profit'    && '✅ Profit'}
                                    {pair.result === 'both-loss' && '❌ Both lost (digit 4 or 5)'}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default HedgeHub;

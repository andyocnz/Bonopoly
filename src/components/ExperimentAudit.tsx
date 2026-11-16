import { type GameConfig } from '../engine/gameEngine'

interface ExperimentAuditProps {
    config: GameConfig
    onClose: () => void
}

export const ExperimentAudit: React.FC<ExperimentAuditProps> = ({ config, onClose }) => {
    return (
        <div className="sl-modal-overlay" onClick={onClose}>
            <div className="sl-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="sl-modal-header">
                    <h3>Simulation Configuration Audit</h3>
                    <button className="sl-btn-close" onClick={onClose}>&times;</button>
                </div>
                <div className="sl-audit-body">
                    <div className="sl-audit-section">
                        <h4>Market Dynamics</h4>
                        <table className="sl-audit-table">
                            <tbody>
                                <tr>
                                    <td>Price Elasticity (US/Asia/EU)</td>
                                    <td>{config.priceDemand.elasticityByRegion.us} / {config.priceDemand.elasticityByRegion.asia} / {config.priceDemand.elasticityByRegion.europe}</td>
                                </tr>
                                <tr>
                                    <td>Baseline Price (US/Asia/EU)</td>
                                    <td>${config.priceDemand.baselinePriceByRegion.us} / ${config.priceDemand.baselinePriceByRegion.asia} / ${config.priceDemand.baselinePriceByRegion.europe}</td>
                                </tr>
                                <tr>
                                    <td>Market Growth Rate (US/Asia/EU)</td>
                                    <td>{config.marketGrowthRate.us}% / {config.marketGrowthRate.asia}% / {config.marketGrowthRate.europe}%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="sl-audit-section">
                        <h4>Customer Preferences (Weights)</h4>
                        <table className="sl-audit-table">
                            <thead>
                                <tr>
                                    <th>Region</th>
                                    <th>Price</th>
                                    <th>Quality</th>
                                    <th>Features</th>
                                    <th>Promo</th>
                                    <th>CSR</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(config.marketPreferences).map(([region, prefs]) => (
                                    <tr key={region}>
                                        <td style={{ textTransform: 'uppercase' }}>{region}</td>
                                        <td>{(prefs.priceWeight * 100).toFixed(0)}%</td>
                                        <td>{(prefs.qualityWeight * 100).toFixed(0)}%</td>
                                        <td>{(prefs.featuresWeight * 100).toFixed(0)}%</td>
                                        <td>{(prefs.promotionWeight * 100).toFixed(0)}%</td>
                                        <td>{(prefs.csrWeight * 100).toFixed(0)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="sl-audit-section">
                        <h4>Cost Structure</h4>
                        <table className="sl-audit-table">
                            <tbody>
                                <tr>
                                    <td>Plant Capacity</td>
                                    <td>{config.capacityPerPlant.toLocaleString()} units/round</td>
                                </tr>
                                <tr>
                                    <td>US Plant Cost</td>
                                    <td>${(config.investment.plantCostUS / 1000000).toFixed(1)}M</td>
                                </tr>
                                <tr>
                                    <td>Asia Plant Cost</td>
                                    <td>${(config.investment.plantCostAsia / 1000000).toFixed(1)}M</td>
                                </tr>
                                <tr>
                                    <td>Unit Material Cost (US/Asia)</td>
                                    <td>${config.unitCosts.directMaterialUS} / ${config.unitCosts.directMaterialAsia}</td>
                                </tr>
                                <tr>
                                    <td>Unit Labor Cost (US/Asia)</td>
                                    <td>${config.unitCosts.directLabourUS} / ${config.unitCosts.directLabourAsia}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="sl-audit-footer">
                        <p>This configuration defines the "Physics" of the simulated world. All AI agents operate within these constraints.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

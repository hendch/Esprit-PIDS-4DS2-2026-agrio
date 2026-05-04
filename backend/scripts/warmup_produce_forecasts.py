import sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.modules.produce_prices.pipeline import ProducePricePipeline

PRODUCTS = [
    'clementine', 'maltaise', 'thomson', 'pommes',
    'oignon', 'piment_doux', 'piment_piquant', 'pomme_de_terre'
]

# Produce data ends in 2022; use a 220-week horizon so forecasts extend into
# 2026/2027 and remain meaningful from today's vantage point.
_HORIZON = 220


def main():
    pipeline = ProducePricePipeline(horizon=_HORIZON)
    total_start = time.time()

    for i, product in enumerate(PRODUCTS, 1):
        print(f'Product {i}/8: {product}...', end=' ', flush=True)
        t = time.time()
        try:
            result = pipeline.run(product)
            elapsed = time.time() - t
            best = result['best_model_name']
            mape = result['backtest_metrics'].get(best, {}).get('mape', 'N/A')
            mape_s = f'{mape:.1f}%' if isinstance(mape, float) else str(mape)
            print(f'done in {elapsed:.1f}s | {best} | MAPE={mape_s}')
        except Exception as e:
            import traceback
            print(f'FAILED')
            traceback.print_exc()

    total = time.time() - total_start
    print(f'\nAll 8 products completed in {total:.1f}s')

if __name__ == '__main__':
    main()

"""Run seed script and report any errors."""
import sys
import traceback

try:
    from app.db.seed import main
    main()
except Exception as e:
    print(f"\nERROR: {e}")
    traceback.print_exc()
    sys.exit(1)

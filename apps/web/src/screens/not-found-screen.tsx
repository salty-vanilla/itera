import { Link } from '@tanstack/react-router';
import { ScreenFrame } from './screen-frame';

function NotFoundScreen() {
  return (
    <ScreenFrame heading="ページが見つかりません">
      <p className="text-body">
        <Link
          to="/today"
          className="rounded-xs text-link underline focus-visible:focus-ring"
        >
          今日を開く
        </Link>
      </p>
    </ScreenFrame>
  );
}

export { NotFoundScreen };

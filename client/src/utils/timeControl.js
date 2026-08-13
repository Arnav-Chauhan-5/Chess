export function getTimeCategory(minutes) {
  if (minutes < 3) return 'Bullet';
  if (minutes <= 10) return 'Blitz';
  if (minutes <= 30) return 'Rapid';
  return 'Classical';
}

const RECENT_KEY = 'tour_recent_places';
const MAX_RECENT = 6;

export function addRecentPlace(place) {
  try {
    const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    const filtered = recent.filter(p => p.id !== place.id);
    filtered.unshift({ id: place.id, name: place.name, image: place.image, rating: place.rating, type: place.type });
    localStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT)));
  } catch { /* localStorage not available */ }
}

export function getRecentPlaces() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch { return []; }
}

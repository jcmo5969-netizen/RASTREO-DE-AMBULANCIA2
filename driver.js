(function(){
  const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  const ambIdEl = document.getElementById('ambId');
  const destEl = document.getElementById('dest');
  const goBtn = document.getElementById('goBtn');
  const etaEl = document.getElementById('eta');
  const gpsEl = document.getElementById('gpsStatus');
  const url = new URL(window.location.href);
  const ambulanceId = url.searchParams.get('amb') || 'SIN_ID';
  ambIdEl.textContent = ambulanceId;
  let currentPos = null;

  async function upsertStatus(extra={}){
    if (!currentPos) return;
    const payload = {
      ambulance_id: ambulanceId,
      lat: currentPos.coords.latitude,
      lng: currentPos.coords.longitude,
      heading: currentPos.coords.heading,
      speed: currentPos.coords.speed,
      updated_at: new Date().toISOString(),
      ...extra
    };
    await supabase.from('ambulance_status').upsert(payload, { onConflict: 'ambulance_id' });
  }

  function watchGPS(){
    if (!('geolocation' in navigator)){ gpsEl.textContent = 'GPS: no disponible en este dispositivo'; return; }
    gpsEl.textContent = 'GPS: solicitando permiso…';
    navigator.geolocation.watchPosition(pos => {
      currentPos = pos;
      gpsEl.textContent = `GPS: OK · ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
      upsertStatus();
    }, err => { gpsEl.textContent = `GPS error: ${err.message}`; }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 });
  }

  async function geocodeAndEta(){
    const destStr = destEl.value?.trim();
    if (!destStr){ etaEl.textContent = 'ETA: ingrese una dirección válida'; return; }
    if (!currentPos){ etaEl.textContent = 'ETA: esperando tu ubicación…'; return; }
    const svc = new google.maps.DirectionsService();
    const origin = { lat: currentPos.coords.latitude, lng: currentPos.coords.longitude };
    try {
      const res = await svc.route({ origin, destination: destStr, travelMode: google.maps.TravelMode.DRIVING });
      const leg = res.routes[0]?.legs[0];
      if (!leg){ etaEl.textContent = 'ETA: no se pudo calcular'; return; }
      const etaSeconds = leg.duration.value;
      etaEl.textContent = `ETA: ${leg.duration.text} (${leg.distance.text})`;
      await upsertStatus({ dest_address: destStr, dest_lat: leg.end_location.lat(), dest_lng: leg.end_location.lng(), eta_seconds: etaSeconds });
    } catch (e){ etaEl.textContent = 'ETA: error al calcular ruta'; }
  }

  goBtn.addEventListener('click', geocodeAndEta);
  new google.maps.places.Autocomplete(destEl, { componentRestrictions: { country: 'cl' } });
  window.addEventListener('load', watchGPS);
})();
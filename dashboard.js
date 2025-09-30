(function(){
  const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  let map, markers = {}, directions = {}, info = {};
  const connStatus = document.getElementById('connStatus');

  function initMap(){
    map = new google.maps.Map(document.getElementById('map'), {
      center: { lat: -33.0472, lng: -71.4425 },
      zoom: 12
    });
  }

  function fmtEta(seconds){
    if (!seconds && seconds !== 0) return '—';
    const m = Math.round(seconds/60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m/60);
    const rm = m%60;
    return `${h} h ${rm} min`;
  }

  function renderAmbulanceCards(){
    const list = document.getElementById('ambulanceList');
    list.innerHTML = '';
    window.AMBULANCES.forEach(a => {
      const url = new URL(window.location.origin + '/driver.html');
      url.searchParams.set('amb', a.id);
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h3>${a.label}</h3>
        <div class="qr">
          <div class="box" id="qr_${a.id}"></div>
          <div>
            <div class="meta">Escanee este QR con el celular del conductor para activar su geolocalización.</div>
            <div class="badge">ID: ${a.id}</div>
            <div class="meta" id="meta_${a.id}">Sin señal…</div>
          </div>
        </div>`;
      list.appendChild(card);
      new QRCode(document.getElementById(`qr_${a.id}`), { text: url.toString(), width: 96, height: 96 });
      info[a.id] = { metaEl: document.getElementById(`meta_${a.id}`) };
    });
  }

  function upsertMarker(row){
    const id = row.ambulance_id;
    if (!markers[id]){
      markers[id] = new google.maps.Marker({
        position: {lat: row.lat, lng: row.lng}, map, title: id,
        icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 5, rotation: row.heading || 0,
          fillColor: '#3aa0ff', fillOpacity: 0.9, strokeColor: '#003b72', strokeWeight: 2 }
      });
    } else {
      markers[id].setPosition({lat: row.lat, lng: row.lng});
      if (row.heading != null) markers[id].setIcon({ path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 5, rotation: row.heading || 0,
        fillColor: '#3aa0ff', fillOpacity: 0.9, strokeColor: '#003b72', strokeWeight: 2 });
    }
    map.panTo({lat: row.lat, lng: row.lng});
    const meta = info[id]?.metaEl;
    if (meta){
      const t = new Date(row.updated_at);
      const dest = row.dest_address ? ` → ${row.dest_address}` : '';
      const eta = row.eta_seconds != null ? ` · ETA ${fmtEta(row.eta_seconds)}` : '';
      meta.textContent = `Última señal ${t.toLocaleTimeString()} · ${row.lat?.toFixed?.(5)}, ${row.lng?.toFixed?.(5)}${dest}${eta}`;
    }
    if (row.dest_lat && row.dest_lng){
      if (!directions[id]){ directions[id] = new google.maps.DirectionsRenderer({ suppressMarkers: true, preserveViewport: true }); directions[id].setMap(map); }
      const svc = new google.maps.DirectionsService();
      svc.route({ origin: { lat: row.lat, lng: row.lng }, destination: { lat: row.dest_lat, lng: row.dest_lng }, travelMode: google.maps.TravelMode.DRIVING })
        .then(res => directions[id].setDirections(res)).catch(()=>{});
    } else if (directions[id]){ directions[id].setMap(null); delete directions[id]; }
  }

  async function initRealtime(){
    connStatus.textContent = '🔌 Conectado';
    const { data: rows } = await supabase.from('ambulance_status').select('*');
    rows?.forEach(upsertMarker);
    supabase.channel('realtime:ambulance_status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambulance_status' }, payload => { if (payload.new) upsertMarker(payload.new); })
      .subscribe();
  }

  function boot(){ initMap(); renderAmbulanceCards(); initRealtime(); }
  window.addEventListener('load', boot);
})();
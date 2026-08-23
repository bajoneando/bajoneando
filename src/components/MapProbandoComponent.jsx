import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { GoogleMap, MarkerF, InfoWindowF, DirectionsRenderer } from '@react-google-maps/api';
import './MapComponent.css';

const containerStyle = {
  width: '100%',
  height: '100%',
};

const MapProbandoComponent = ({ 
  localLat, 
  localLng, 
  pedidosActivos = [],
  driverLat,
  driverLng,
  localName = 'Local', 
  isLoaded,
  directions,
  routeSequence = [],
  ciudad = 'Santo Tomé'
}) => {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [map, setMap] = useState(null);

  const getCityConfig = useCallback((cityName) => {
    if (String(cityName || '').toLowerCase().includes('ober')) {
      return {
        center: { lat: -27.485, lng: -55.120 },
        bounds: { north: -27.3, south: -27.7, west: -55.3, east: -54.9 },
        zoom: 15
      };
    }
    // Default: Santo Tomé
    return {
      center: { lat: -28.548, lng: -56.041 },
      bounds: { north: -28.3, south: -28.8, west: -56.3, east: -55.8 },
      zoom: 15
    };
  }, []);

  const cityConfig = useMemo(() => getCityConfig(ciudad), [ciudad, getCityConfig]);

  const [mapCenter, setMapCenter] = useState(cityConfig.center);
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    if (driverLat && driverLng) {
      setMapCenter({ lat: Number(driverLat), lng: Number(driverLng) });
      initializedRef.current = true;
    } else if (localLat && localLng) {
      setMapCenter({ lat: Number(localLat), lng: Number(localLng) });
      initializedRef.current = true;
    }
  }, [driverLat, driverLng, localLat, localLng]);

  const isWithinCity = useCallback((lat, lng, cityName) => {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const config = getCityConfig(cityName);
    
    const maxLat = Math.max(config.bounds.north, config.bounds.south);
    const minLat = Math.min(config.bounds.north, config.bounds.south);
    const maxLng = Math.max(config.bounds.west, config.bounds.east);
    const minLng = Math.min(config.bounds.west, config.bounds.east);
    
    return latNum <= maxLat && latNum >= minLat && lngNum <= maxLng && lngNum >= minLng;
  }, [getCityConfig]);

  const markers = useMemo(() => {
    const m = [];
    const hayPendientesDeRetiro = pedidosActivos.some(p => p.estado !== 'Retirado');
    
    const getSequenceNumber = (lat, lng) => {
        if (!routeSequence || routeSequence.length === 0) return null;
        const idx = routeSequence.findIndex(s => 
            Math.abs(s.lat - Number(lat)) < 0.0005 && 
            Math.abs(s.lng - Number(lng)) < 0.0005
        );
        return idx !== -1 ? idx + 1 : null;
    };

    if (localLat && localLng && isWithinCity(localLat, localLng, ciudad) && hayPendientesDeRetiro) {
      const seqNum = getSequenceNumber(localLat, localLng);
      m.push({
        id: 'local',
        position: { lat: Number(localLat), lng: Number(localLng) },
        title: localName,
        label: {
          text: seqNum ? `(${seqNum}) ${localName}` : localName,
          color: 'black',
          fontSize: '12px',
          fontWeight: '900'
        },
        icon: 'https://i.postimg.cc/ZKHbrvdP/Home-free-icons-designed-by-nawicon-(1).png'
      });
    }

    pedidosActivos.forEach((p, index) => {
        if (p.estado === 'Retirado' && p.lat && p.lng && isWithinCity(p.lat, p.lng, ciudad)) {
            const seqNum = getSequenceNumber(p.lat, p.lng);
            m.push({
                id: `pedido-${p.id}`,
                position: { lat: Number(p.lat), lng: Number(p.lng) },
                title: p.direccion,
                label: {
                  text: seqNum ? `${seqNum}. Entrega` : `Entrega`,
                  color: 'black',
                  fontSize: '12px',
                  fontWeight: '900'
                },
                icon: 'https://i.postimg.cc/zfbqZdPs/Home-free-icons-designed-by-nawicon.png'
            });
        }
    });

    if (driverLat && driverLng && isWithinCity(driverLat, driverLng, ciudad)) {
      m.push({
        id: 'driver',
        position: { lat: Number(driverLat), lng: Number(driverLng) },
        title: 'Tu ubicación',
        icon: 'https://i.postimg.cc/GtL50wyB/buscamos-repartidores-(48)-(1).png'
      });
    }
    return m;
  }, [localLat, localLng, pedidosActivos, driverLat, driverLng, localName, ciudad, isWithinCity, routeSequence]);

  const onLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  if (!isLoaded) return <div style={{ height: '100%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando mapa...</div>;

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={mapCenter}
      zoom={15}
      onLoad={onLoad}
      options={{
        mapTypeControl: false,
        streetViewControl: false,
        clickableIcons: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
        styles: [
          {
            featureType: 'poi',
            stylers: [{ visibility: 'off' }]
          },
          {
            featureType: 'transit',
            stylers: [{ visibility: 'off' }]
          }
        ],
        restriction: {
          latLngBounds: cityConfig.bounds,
          strictBounds: false
        }
      }}
    >
      {markers.map(m => (
        <MarkerF
          key={m.id}
          position={m.position}
          title={m.title}
          icon={m.icon ? {
            url: m.icon,
            scaledSize: new window.google.maps.Size(40, 40),
            labelOrigin: new window.google.maps.Point(20, -10)
          } : null}
          label={m.label}
          onClick={() => setSelectedMarker(m)}
        />
      ))}

      {selectedMarker && (
        <InfoWindowF
          position={selectedMarker.position}
          onCloseClick={() => setSelectedMarker(null)}
        >
          <div style={{ padding: '8px', minWidth: '150px' }}>
            <h4 style={{ margin: '0 0 5px 0', fontSize: '0.9rem' }}>{selectedMarker.title}</h4>
            {selectedMarker.label && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--red-600)', fontWeight: 'bold' }}>{selectedMarker.label.text}</p>}
          </div>
        </InfoWindowF>
      )}

      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: {
              strokeColor: '#4285F4',
              strokeWeight: 6,
              strokeOpacity: 0.9
            }
          }}
        />
      )}
    </GoogleMap>
  );
};

export default React.memo(MapProbandoComponent);

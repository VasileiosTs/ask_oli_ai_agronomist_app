import { useState, useEffect } from 'react';
import { Cloud, Droplets, Wind, Thermometer } from 'lucide-react';

interface Props {
  lat: number | null;
  lon: number | null;
  lang: string;
}

interface WeatherData {
  temperature: number;
  humidity: number;
  precipitation: number;
  wind: number;
}

export default function WeatherWidget({ lat, lon, lang }: Props) {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (!lat || !lon) return;
    const controller = new AbortController();
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&timezone=auto`,
      { signal: controller.signal },
    )
      .then(r => r.json())
      .then(data => {
        if (data.current) {
          setWeather({
            temperature: data.current.temperature_2m,
            humidity: data.current.relative_humidity_2m,
            precipitation: data.current.precipitation,
            wind: data.current.wind_speed_10m,
          });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [lat, lon]);

  if (!weather) return null;

  return (
    <div className="mx-4 mt-3 grid grid-cols-4 gap-2">
      {[
        { icon: Thermometer, value: `${weather.temperature}°`, label: lang === 'el' ? 'Θερμ.' : 'Temp' },
        { icon: Droplets, value: `${weather.humidity}%`, label: lang === 'el' ? 'Υγρ.' : 'Hum.' },
        { icon: Cloud, value: `${weather.precipitation}mm`, label: lang === 'el' ? 'Βροχή' : 'Rain' },
        { icon: Wind, value: `${weather.wind}km/h`, label: lang === 'el' ? 'Άνεμος' : 'Wind' },
      ].map(({ icon: I, value, label }) => (
        <div key={label} className="rounded-xl bg-surface border border-border/30 p-2.5 text-center">
          <I className="mx-auto h-3.5 w-3.5 text-muted mb-1" />
          <p className="text-sm font-semibold text-foreground">{value}</p>
          <p className="text-[10px] text-muted">{label}</p>
        </div>
      ))}
    </div>
  );
}

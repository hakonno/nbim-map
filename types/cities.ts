export type CityProperty = {
  id: string;
  name: string | null;
  address: string | null;
  partnership: string | null;
  sector: string | null;
  lat?: number | null;
  lng?: number | null;
  ownership_percent: number | null;
  value_nok: number | null;
  value_usd: number | null;
};

export type CityNode = {
  id: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
  properties: CityProperty[];
  total_ownership_sum: number;
};

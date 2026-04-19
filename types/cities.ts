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

export type GlobalOverviewContract = {
  totalCities: number;
  totalCountries: number;
  totalProperties: number;
  estimatedPortfolioValueNok: number | null;
  estimatedPortfolioValueUsd: number | null;
};

export type CityAggregateContract = {
  cityId: string;
  propertyCount: number;
  ownershipExposurePercent: number | null;
  estimatedExposureNok: number | null;
};

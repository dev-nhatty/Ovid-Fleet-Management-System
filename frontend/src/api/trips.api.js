import { api } from './client.js';
export function listTrips({page=1,pageSize=7,q='',status='All',tripType='All',department='All',period='all'}={}) {const p=new URLSearchParams({page,pageSize,q,status,tripType,department,period});return api(`/trips?${p}`);}
export function getTrip(tripId){return api(`/trips/${tripId}`);}
export function updateTripStatus(tripId,status,options={}){return api(`/trips/${tripId}/status`,{method:'PATCH',body:{status,...(status==='Cancelled'?{checkpointIds:options.checkpointIds||[]}:{})}});}

export const updateTripDistance = (tripId, distanceKm) => api(`/trips/${encodeURIComponent(tripId)}/distance`, { method: 'PATCH', body: { distanceKm } });

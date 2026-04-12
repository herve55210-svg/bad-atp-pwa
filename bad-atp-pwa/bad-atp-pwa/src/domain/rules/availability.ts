export type Status = 'PRESENT'|'ABSENT'|'DISPENSE';

export function canPlay(status: Status): boolean {
  return status === 'PRESENT';
}

export function canReferee(status: Status): boolean {
  return status === 'PRESENT' || status === 'DISPENSE';
}

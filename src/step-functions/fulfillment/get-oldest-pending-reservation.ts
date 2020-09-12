import { Handler } from "aws-lambda";
import { Reservation } from "../../model";

interface GetOldestPendingReservationOutput {
  reservation?: Reservation;
}

export const getOldestPendingReservation: Handler<
  any,
  GetOldestPendingReservationOutput
> = async (_event, _context) => {
  return {};
};

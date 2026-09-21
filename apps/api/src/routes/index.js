import { Router } from 'express';
import healthCheck from './health-check.js';
import { createOrder, verifyPayment } from './razorpay.js';
import {
  status as rapidshypStatus,
  getRate as rapidshypRate,
  createShipment,
  assignAwb,
  getLabel,
  bookAppointment,
  cancelShipment,
  deallocateShipment,
} from './rapidshyp.js';

const router = Router();

export default () => {
    router.get('/health', healthCheck);
    router.post('/razorpay/create-order', createOrder);
    router.post('/razorpay/verify-payment', verifyPayment);

    // RapidShyp shipping
    router.get('/rapidshyp/status', rapidshypStatus);
    router.post('/rapidshyp/rate', rapidshypRate);
    router.post('/rapidshyp/create', createShipment);
    router.post('/rapidshyp/assign-awb', assignAwb);
    router.post('/rapidshyp/label', getLabel);
    router.post('/rapidshyp/appointment', bookAppointment);
    router.post('/rapidshyp/cancel', cancelShipment);
    router.post('/rapidshyp/deallocate', deallocateShipment);

    return router;
};


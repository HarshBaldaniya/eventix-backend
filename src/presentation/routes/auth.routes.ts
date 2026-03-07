// Auth routes - register, login, logout, refresh
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../../application/services/auth.service';
import { UserRepository } from '../../infrastructure/repositories/user.repository';
import { SessionRepository } from '../../infrastructure/repositories/session.repository';
const router = Router();
const userRepo = new UserRepository();
const sessionRepo = new SessionRepository();
const authService = new AuthService(userRepo, sessionRepo);
const authController = new AuthController(authService);

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);

export const authRoutes = router;

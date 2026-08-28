import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'snooker-club-api',
    });
  });

  it('/auth/login (POST)', async () => {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error('Seed admin credentials are required for the e2e test.');
    }

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    expect(response.body).toHaveProperty('user.email', email.toLowerCase());
    expect(response.body).not.toHaveProperty('token');
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(response.headers['set-cookie']?.[0]).toContain('SameSite=Strict');
  });

  afterEach(async () => {
    await app.close();
  });
});

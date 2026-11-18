import { Environment } from '@mockoon/commons';
import { expect } from 'chai';
import { Request } from 'express';
import { promises as fs } from 'fs';
import { parse as pathParse, resolve as pathResolve } from 'path';
import { MockoonServer } from '../../../src';

async function getEnvironment(): Promise<Environment> {
  const environmentJson = await fs.readFile(
    './test/data/environments/test-env.json',
    'utf-8'
  );

  return JSON.parse(environmentJson) as Environment;
}

describe('Server file serving', () => {
  let environment: Environment;

  before(async () => {
    environment = await getEnvironment();
  });

  describe('Templated file path safety', () => {
    const buildRequest = (query: Record<string, string>): Request =>
      ({
        params: {},
        query
      }) as unknown as Request;
    const callGetSafeFilePath = (
      server: MockoonServer,
      filePath: string,
      request?: Request
    ) =>
      (
        server as unknown as {
          getSafeFilePath: (input: string, req?: Request) => string;
        }
      ).getSafeFilePath(filePath, request);

    it('should block absolute templated paths escaping to a sibling directory with a shared prefix', () => {
      const server = new MockoonServer(environment, {
        environmentDirectory: pathResolve('./test/data/environments')
      });
      const publicDir = pathResolve('./test/data/public');

      expect(() =>
        callGetSafeFilePath(
          server,
          `${publicDir}/{{queryParam 'name'}}`,
          buildRequest({ name: '../public_backup/secret.txt' })
        )
      ).to.throw(/outside of the original static base directory/);
    });

    it('should block relative templated paths from escaping a nested static base when the environment directory is root', () => {
      const server = new MockoonServer(environment, {
        environmentDirectory: pathParse(pathResolve('./test/data')).root
      });

      expect(() =>
        callGetSafeFilePath(
          server,
          `./static/{{queryParam 'name'}}`,
          buildRequest({ name: '../static_secret.txt' })
        )
      ).to.throw(/outside of the allowed base directory/);
    });

    it('should reject templated file paths when the only allowed base directory is the filesystem root', () => {
      const server = new MockoonServer(environment, {
        environmentDirectory: pathParse(pathResolve('./test/data')).root
      });

      expect(() =>
        callGetSafeFilePath(
          server,
          `./{{queryParam 'name'}}`,
          buildRequest({ name: 'test.data' })
        )
      ).to.throw(/requires a non-root base directory/);
    });

    it('should allow templated relative paths that stay within their static base', () => {
      const server = new MockoonServer(environment, {
        environmentDirectory: pathParse(pathResolve('./test/data')).root
      });

      expect(
        callGetSafeFilePath(
          server,
          `./static/{{queryParam 'name'}}`,
          buildRequest({ name: 'asset.txt' })
        )
      ).to.equal(
        pathResolve(
          pathParse(pathResolve('./test/data')).root,
          'static/asset.txt'
        )
      );
    });

    it('should allow templated relative paths when the helper is in the middle of the file name', () => {
      const server = new MockoonServer(environment, {
        environmentDirectory: pathResolve('./test/data')
      });

      expect(
        callGetSafeFilePath(
          server,
          `./static/file{{queryParam 'name'}}.json`,
          buildRequest({ name: '1' })
        )
      ).to.equal(pathResolve('./test/data', 'static/file1.json'));
    });

    it('should allow an absolute partially templated file path', () => {
      const server = new MockoonServer(environment, {
        environmentDirectory: pathResolve('./test/data')
      });
      const publicDir = pathResolve('./test/data/public');

      expect(
        callGetSafeFilePath(
          server,
          `${publicDir}\\file{{queryParam 'name'}}.json`,
          buildRequest({ name: '1' })
        )
      ).to.equal(pathResolve(publicDir, 'file1.json'));
    });

    it('should block templated paths escaping the static base when the helper is in the middle of the file name', () => {
      const server = new MockoonServer(environment, {
        environmentDirectory: pathResolve('./test/data')
      });
      const publicDir = pathResolve('./test/data/public');

      expect(() =>
        callGetSafeFilePath(
          server,
          `${publicDir}/file{{queryParam 'name'}}.json`,
          buildRequest({ name: '/../../secret' })
        )
      ).to.throw(/outside of the original static base directory/);
    });

    it('should block relative templated paths escaping the environment directory', () => {
      const server = new MockoonServer(environment, {
        environmentDirectory: pathResolve('./test/data/environments')
      });

      expect(() =>
        callGetSafeFilePath(
          server,
          `./{{queryParam 'name'}}`,
          buildRequest({ name: '../../package.json' })
        )
      ).to.throw(/outside of the allowed base directory/);
    });

    it('should block absolute paths injected in a fully templated file path', () => {
      const server = new MockoonServer(environment, {
        environmentDirectory: pathResolve('./test/data/environments')
      });

      expect(() =>
        callGetSafeFilePath(
          server,
          `{{queryParam 'name'}}`,
          buildRequest({ name: pathResolve('./package.json') })
        )
      ).to.throw(/requires a non-root base directory/);
    });

    it('should allow fully templated relative paths that stay within the environment directory', () => {
      const server = new MockoonServer(environment, {
        environmentDirectory: pathResolve('./test/data/environments')
      });

      expect(
        callGetSafeFilePath(
          server,
          `{{queryParam 'name'}}`,
          buildRequest({ name: 'test-env.json' })
        )
      ).to.equal(pathResolve('./test/data/environments', 'test-env.json'));
    });

    it('should block templated paths when no environment directory is provided and the path escapes the working directory', () => {
      const server = new MockoonServer(environment);

      expect(() =>
        callGetSafeFilePath(
          server,
          `./{{queryParam 'name'}}`,
          buildRequest({ name: '../secret.txt' })
        )
      ).to.throw(/outside of the allowed base directory/);
    });

    it('should not restrict file paths without templating', () => {
      const server = new MockoonServer(environment, {
        environmentDirectory: pathResolve('./test/data/environments')
      });

      expect(callGetSafeFilePath(server, '../plain.data')).to.equal(
        pathResolve('./test/data/plain.data')
      );
    });
  });
});

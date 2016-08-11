docker build -t encrs3 .
docker rm -f encrs3
docker run -d --name encrs3 -v $(pwd)/.env:/app/.env encrs3
docker logs -f encrs3

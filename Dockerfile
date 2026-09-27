FROM python:3.12-slim
WORKDIR /app
COPY processing/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY processing /app/processing
RUN pip install --no-cache-dir --no-deps -e /app/processing
WORKDIR /work
ENTRYPOINT ["siret3"]
CMD ["--help"]

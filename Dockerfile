FROM python:3.11-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Dépendances système (une seule couche) :
# - libpq-dev / postgresql-client : PostgreSQL
# - libcairo2-dev / pkg-config     : pycairo (via xhtml2pdf / svglib)
# - libjpeg / zlib / freetype      : Pillow, ReportLab
# - poppler-utils                  : pdf2image
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc python3-dev pkg-config \
    libcairo2-dev libjpeg-dev zlib1g-dev libfreetype6-dev \
    postgresql-client poppler-utils \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Valeurs factices UNIQUEMENT pour cette commande (pas stockées dans l'image).
# Au démarrage du conteneur, Django lit les vraies valeurs du .env du VPS.
RUN SECRET_KEY=cle-factice-build-uniquement \
    GROQ_API_KEY=cle-factice-build-uniquement \
    python manage.py collectstatic --noinput

EXPOSE 8004

CMD ["gunicorn", "Opera_CTN.wsgi:application", "--bind", "0.0.0.0:8004", "--workers", "3", "--timeout", "120"]
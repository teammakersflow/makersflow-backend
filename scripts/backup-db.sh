#!/bin/bash

mkdir -p backups

pg_dump \
-h $DB_HOST \
-p $DB_PORT \
-U $DB_USER \
-F c \
-d $DB_NAME \
-f backups/makersflow.backup
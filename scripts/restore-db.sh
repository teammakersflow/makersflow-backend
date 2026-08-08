#!/bin/bash

pg_restore \
-h $DB_HOST \
-p $DB_PORT \
-U $DB_USER \
-d $DB_NAME \
backups/makersflow.backup
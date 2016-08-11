#!/bin/bash

#docker start command

while read line
do
  if [ -z "$line" ]; then # is empty
    continue
  fi
  if echo  "$line" | grep -q '^#'; then # is comment
    continue
  fi
  export "${line// /}"
done < $(pwd)/.env

node index.js

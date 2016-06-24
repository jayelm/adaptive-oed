# webppl doesn't find the packages if the wppl file is in the examples directory so make a symlink
%.wppl : examples/%.wppl
	@ln -s "$<" .

_%.js : %.wppl src/oed.wppl
	@webppl "$<" --require ./data --require . --require underscore --require console.table --require babyparse --require minimist --compile --out "$@"
	@sed -i -e 's/var console\.table/var consoleTable/' "$@"

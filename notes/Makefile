default:
	make html

html:
	pandoc --smart \
		--standalone \
		--section-divs \
		--include-in-header style.css \
		-o build/notes.html *.markdown

pdf:
	pandoc --smart \
		--standalone \
		--section-divs \
		-o build/notes.pdf *.markdown

clean:
	rm build/*

out: 
	zip out.zip $(find -type f -not -name *.zip -not -path *.git*)

clean:
	rm out.zip
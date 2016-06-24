# Libs ====
library(ggplot2)

gg_color_hue <- function(n) {
  hues = seq(15, 375, length = n + 1)
  hcl(h = hues, l = 65, c = 100)[1:n]
}

# Load data, transform ====
eigs = read.csv("seq_sample.csv", stringsAsFactors = FALSE)
# Get one column which is just pasted
eigs$trial = paste0(eigs$t1, ",", eigs$t2)
eigs$tset = sapply(1:length(eigs$t1), function(i) {
  row = eigs[i, ]
  ts.sorted = sort(c(row$t1, row$t2))
  paste0(ts.sorted[1], ",", ts.sorted[2])
})


# Histogram ====
# Distribution of eigenvalues
ggplot(eigs) +
  geom_histogram(aes(x = eig), fill = 'navy', color = 'black') +
  geom_density(aes(x = eig), fill = 'cyan', color = 'black', alpha = 0.2) +
  xlab("EIG") +
  ylab("Count") +
  theme_bw()


# Plot some selected choices ====
# Recall that choices are symmetric (replacing Ts with Fs has same EIG)
# and that order doesn't matter
# This allows us to narrow down considerably
# Assert that, when order doesn't matter, everything is the same. YUP
all(sapply(unique(eigs$tset), function(tset) {
  subs = eigs[eigs$tset == tset, ]
  all.equal(subs$eig, rep(subs$eig[1], length(subs$eig)))
}))

eigs.sorted = eigs[rev(order(eigs$eig)), c("tset", "eig")]

interests = c("TTTT,TTTT", "TTTT,TFTF", "TTTT,TTFF", "TTTT,TFFT", "TFFT,TFFT", "TFTF,TTTT", "TTTT,TFTF")

ggplot(subset(eigs, trial %in% interests), aes(x = trial, y = eig)) +
  geom_bar(stat = "identity", fill = gg_color_hue(1), color = 'black') +
  xlab("EIG") +
  ylab("Count") +
  scale_y_continuous(limits = c(0, 1), breaks = seq(0, 1, by = 0.2)) +
  coord_flip() +
  theme_bw()
